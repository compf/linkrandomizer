import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { provideNativeDateAdapter } from "@angular/material/core";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatTooltipModule } from "@angular/material/tooltip";
import {
  type DatePeriod,
  type YoutubeFetchProgress,
  type YoutubeFetchResult,
  type YoutubeLibrary,
  type YoutubeSource,
  type YoutubeVideo,
  calendarDayFromJsDate,
  emptyYoutubeLibrary,
  extractedDateFromPublished,
  formatDateLabel,
  formatPeriodLabel,
  mergeYoutubeLibraries,
  parseYoutubeLibraryJson,
  serializeYoutubeLibrary,
  videoMatchesPeriod,
} from "@linkrandomizer/common";
import { FrontendService } from "../../frontend-handler/frontend-service";

type PeriodMode = "any" | "year" | "yearMonth" | "range";

let activeLoad: Promise<YoutubeFetchResult> | null = null;

@Component({
  selector: "app-youtube-randomizer",
  templateUrl: "./youtube-randomizer.html",
  styleUrls: ["./youtube-randomizer.css"],
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
})
export class YoutubeRandomizerComponent implements OnInit, OnDestroy {
  readonly isElectron = inject(FrontendService).isElectron;

  library = signal<YoutubeLibrary>(emptyYoutubeLibrary());
  loading = signal(false);
  progress = signal("");
  error = signal("");
  notice = signal("");
  picked = signal<YoutubeVideo | null>(null);
  copied = signal(false);

  urlInput = "";
  periodMode: PeriodMode = "any";
  periodYear = new Date().getFullYear();
  periodMonth = new Date().getMonth() + 1;
  rangeStart: Date | null = null;
  rangeEnd: Date | null = null;
  pickerMinDate = new Date(2005, 0, 1);
  pickerMaxDate = new Date();

  private alive = true;
  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  ngOnInit() {
    window.api.eventFromBackend.youtubeFetchProgress(undefined, (progress: YoutubeFetchProgress) => {
      if (this.alive && progress?.message) {
        this.progress.set(progress.message);
      }
    });
    void this.reload();
  }

  ngOnDestroy() {
    this.alive = false;
    if (this.copyTimer !== undefined) {
      clearTimeout(this.copyTimer);
    }
  }

  selected(): YoutubeSource | undefined {
    const library = this.library();
    return library.sources.find((source) => source.id === library.selectedId) ?? library.sources[0];
  }

  filtered(): YoutubeVideo[] {
    const source = this.selected();
    if (!source) {
      return [];
    }
    return source.videos.filter((video) => videoMatchesPeriod(video, this.currentPeriod()));
  }

  periodLabel(): string {
    return formatPeriodLabel(this.currentPeriod());
  }

  filterActive(): boolean {
    return this.currentPeriod() !== undefined;
  }

  publishedLabel(video: YoutubeVideo): string {
    return formatDateLabel(extractedDateFromPublished(video.published)) ?? video.published;
  }

  fetchedLabel(source: YoutubeSource): string {
    const parsed = Date.parse(source.fetchedAt);
    if (!Number.isFinite(parsed)) {
      return "";
    }
    return `Saved ${new Date(parsed).toLocaleString()}`;
  }

  undatedCount(source: YoutubeSource): number {
    return source.videos.filter((video) => !video.published).length;
  }

  canLoad(): boolean {
    return this.isElectron && !this.loading() && this.urlInput.trim().length > 0;
  }

  async loadCatalog() {
    if (!this.isElectron) {
      this.error.set("Downloading a YouTube catalog needs the desktop app. Import a library exported from Electron.");
      return;
    }
    const url = this.urlInput.trim();
    if (!url || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set("");
    this.notice.set("");
    this.progress.set("Starting…");
    const promise = window.api.invokeFromBackend.fetchYoutubeSource({ url });
    activeLoad = promise;
    try {
      const result = await promise;
      if (this.alive) {
        this.applyFetchResult(result);
      }
    } finally {
      if (activeLoad === promise) {
        activeLoad = null;
      }
      if (this.alive) {
        this.loading.set(false);
        this.progress.set("");
      }
    }
  }

  refreshSelected() {
    const source = this.selected();
    if (!source) {
      return;
    }
    this.urlInput = source.sourceUrl;
    void this.loadCatalog();
  }

  select(id: string) {
    const library = this.library();
    if (library.selectedId === id) {
      return;
    }
    this.picked.set(null);
    this.library.set({ ...library, selectedId: id });
    void this.persist();
  }

  async remove(source: YoutubeSource) {
    if (!window.confirm(`Remove “${source.title}” from this computer? The export file is not affected.`)) {
      return;
    }
    const sources = this.library().sources.filter((entry) => entry.id !== source.id);
    const selectedId = this.library().selectedId === source.id ? sources[0]?.id : this.library().selectedId;
    this.picked.set(null);
    this.library.set(selectedId ? { sources, selectedId } : { sources });
    await this.persist();
  }

  pickRandom() {
    const pool = this.filtered();
    if (pool.length === 0) {
      this.picked.set(null);
      return;
    }
    const currentId = this.picked()?.id;
    const candidates = pool.length > 1 && currentId ? pool.filter((video) => video.id !== currentId) : pool;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    this.picked.set(choice ?? null);
    this.copied.set(false);
  }

  openPicked() {
    const video = this.picked();
    if (video) {
      this.openVideo(video);
    }
  }

  openVideo(video: YoutubeVideo) {
    window.api.sendToBackend.openUrlInBrowser({ url: video.url });
  }

  async copyPicked() {
    const video = this.picked();
    if (!video) {
      return;
    }
    const copied = await copyText(video.url);
    this.copied.set(copied);
    this.error.set(copied ? "" : "Couldn't copy the URL. Select it from the box instead.");
    if (this.copyTimer !== undefined) {
      clearTimeout(this.copyTimer);
    }
    this.copyTimer = setTimeout(() => this.copied.set(false), 1600);
  }

  async exportLibrary() {
    this.error.set("");
    const result = await window.api.invokeFromBackend.exportYoutubeLibrary({
      json: serializeYoutubeLibrary(this.library()),
    });
    if (result.ok === false) {
      if ("error" in result) {
        this.error.set(result.error);
      }
      return;
    }
    this.notice.set(this.isElectron ? `Exported to ${result.path}` : "Download started.");
  }

  async onImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }
    this.error.set("");
    this.notice.set("");
    let text = "";
    try {
      text = await file.text();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
      return;
    }
    const parsed = parseYoutubeLibraryJson(text);
    if (parsed.ok === false) {
      this.error.set(parsed.error);
      return;
    }
    const merged = mergeYoutubeLibraries(this.library(), parsed.library);
    this.library.set(merged);
    this.picked.set(null);
    const saved = await this.persist();
    if (saved) {
      const count = parsed.library.sources.length;
      this.notice.set(`Imported ${count} ${count === 1 ? "source" : "sources"}. They stay on this computer after you close the app.`);
    }
  }

  onPeriodChange() {
    this.picked.set(null);
    this.periodYear = Math.trunc(Number(this.periodYear)) || new Date().getFullYear();
    this.periodMonth = Math.min(12, Math.max(1, Math.trunc(Number(this.periodMonth)) || 1));
  }

  private async reload() {
    try {
      const library = (await window.api.invokeFromBackend.loadYoutubeLibrary()) ?? emptyYoutubeLibrary();
      if (!this.alive) {
        return;
      }
      this.library.set(normalizeLibrary(library));
    } catch (error) {
      if (this.alive) {
        this.error.set(error instanceof Error ? error.message : String(error));
      }
    }
    if (activeLoad) {
      this.loading.set(true);
      const result = await activeLoad;
      if (!this.alive) {
        return;
      }
      this.applyFetchResult(result);
      this.loading.set(false);
      this.progress.set("");
    }
  }

  private applyFetchResult(result: YoutubeFetchResult) {
    if (result.ok === false) {
      this.error.set(result.error);
      return;
    }
    this.library.set(normalizeLibrary(result.library));
    this.picked.set(null);
    this.notice.set(result.warning || "Saved on this computer. You can close the app and the list will still be here.");
  }

  private async persist(): Promise<boolean> {
    const saved = await window.api.invokeFromBackend.saveYoutubeLibrary(this.library());
    if (saved.ok === false) {
      this.error.set(saved.error);
      return false;
    }
    return true;
  }

  private currentPeriod(): DatePeriod | undefined {
    if (this.periodMode === "year") {
      return { year: this.periodYear };
    }
    if (this.periodMode === "yearMonth") {
      return { year: this.periodYear, month: this.periodMonth };
    }
    if (this.periodMode === "range") {
      return dateRangePeriod(this.rangeStart, this.rangeEnd);
    }
    return undefined;
  }
}

const dateRangePeriod = (start: Date | null, end: Date | null): DatePeriod | undefined => {
  if (!start && !end) {
    return undefined;
  }
  const period: DatePeriod = {};
  if (start) {
    period.start = calendarDayFromJsDate(start);
  }
  if (end) {
    period.end = calendarDayFromJsDate(end);
  }
  return period;
};

const normalizeLibrary = (library: YoutubeLibrary): YoutubeLibrary => {
  const sources = Array.isArray(library?.sources) ? library.sources : [];
  const selectedId = sources.some((source) => source.id === library?.selectedId)
    ? library.selectedId
    : sources[0]?.id;
  return selectedId ? { sources, selectedId } : { sources };
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
};
