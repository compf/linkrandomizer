import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { provideNativeDateAdapter } from "@angular/material/core";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import {
  ChatHistory,
  ChatMessage,
  DatePeriod,
  GeneratedURL,
  URL_BRIEF_PROMPT,
  UrlAnnotation,
  UrlAnnotationStore,
  UrlScreenshot,
  Website,
  annotationIsEmpty,
  briefingRequestForUrl,
  calendarDayFromJsDate,
  compareVisibleUrls,
  emptyAnnotation,
  formatCoverageLabel,
  formatGeneratedUrl,
  formatPeriodLabel,
  generateUrlBatch,
  getPeriodBriefing,
  getTagsForWebsites,
  jsDateFromCalendarDay,
  loadExtractedUrls,
  publicWebsites,
  tryGenerateRandomURL,
  websiteCoverage,
  websiteDisplayName,
  websiteSupportsPeriod,
} from "@linkrandomizer/common";
import showdown from "showdown";

const converter = new showdown.Converter();
const BATCH_SIZE = 6;
const DEFAULT_SITES = ["nytimes time machine", "newspapers_com"];
const BRIEFING_DEBOUNCE_MS = 400;
const NOTE_SAVE_DEBOUNCE_MS = 400;
const MAX_COMPARE_URLS = 40;

type NamedWebsite = { name: string; website: Website };
type PeriodMode = "any" | "year" | "yearMonth" | "range";
type SelectedCard = { site: string; index: number };

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(blob);
  });

const screenshotId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `shot-${Date.now()}-${Math.random().toString(16).slice(2)}`;

@Component({
  selector: "app-url-explorer",
  templateUrl: "./url-explorer.html",
  styleUrls: ["./url-explorer.css"],
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
})
export class UrlExplorerComponent implements OnInit, OnDestroy {
  allWebsites = signal<NamedWebsite[]>([]);
  allTags = signal<string[]>([]);
  selectedTags: Record<string, boolean> = {};

  workingSet = signal<string[]>([]);
  visibleSlots = signal<[string | null, string | null]>([null, null]);
  focusedSlot = signal<0 | 1>(0);
  stacks = signal<Record<string, GeneratedURL[]>>({});
  selected = signal<SelectedCard | null>(null);

  periodMode: PeriodMode = "yearMonth";
  periodYear = 1968;
  periodMonth = 11;
  rangeStart: Date | null = jsDateFromCalendarDay({ year: 1968, month: 11, day: 1 });
  rangeEnd: Date | null = jsDateFromCalendarDay({ year: 1969, month: 9, day: 30 });
  pickerMinDate = jsDateFromCalendarDay({ year: 1000, month: 1, day: 1 });
  pickerMaxDate = jsDateFromCalendarDay({ year: 2026, month: 12, day: 31 });

  periodBriefing = signal<string | null>(null);
  periodBriefingLoading = signal(false);
  periodBriefingError = signal("");
  chatMessages = signal<ChatHistory>([]);
  chatInput = "";
  chatLoading = signal(false);
  copied = signal(false);

  annotations = signal<UrlAnnotationStore>({});
  draftNotes = "";
  draftTagInput = "";
  annotationSaveError = signal("");
  compareResult = signal<string | null>(null);
  compareLoading = signal(false);
  compareError = signal("");

  private briefingTimer: ReturnType<typeof setTimeout> | undefined;
  private briefingRequestId = 0;
  private copyTimer: ReturnType<typeof setTimeout> | undefined;
  private noteTimer: ReturnType<typeof setTimeout> | undefined;

  async ngOnInit() {
    try {
      await loadExtractedUrls();
    } catch (error) {
      console.error("Error loading extracted URLs:", error);
    }

    try {
      const stored = await window.api.invokeFromBackend.loadUrlAnnotations();
      this.annotations.set(stored ?? {});
    } catch (error) {
      console.error("Error loading URL annotations:", error);
    }

    const named = Object.entries(publicWebsites).map(([name, website]) => ({ name, website }));
    this.allWebsites.set(named);
    this.allTags.set(getTagsForWebsites(named.map((entry) => entry.website)));
    for (const tag of this.allTags()) {
      this.selectedTags[tag] = true;
    }

    const initial = DEFAULT_SITES.filter((name) => publicWebsites[name]);
    this.workingSet.set(initial);
    this.visibleSlots.set([initial[0] ?? null, initial[1] ?? null]);
    this.refillVisibleColumns();

    window.api.eventFromBackend.onContentLoaded(undefined, (data: ChatMessage) => {
      this.chatMessages.update((messages) => [...messages, { content: data, sender: "user" }]);
      this.chatLoading.set(false);
    });
  }

  ngOnDestroy() {
    if (this.briefingTimer !== undefined) {
      clearTimeout(this.briefingTimer);
    }
    if (this.copyTimer !== undefined) {
      clearTimeout(this.copyTimer);
    }
    this.flushNotes();
  }

  currentPeriod(): DatePeriod | undefined {
    if (this.periodMode === "any") {
      return undefined;
    }
    if (this.periodMode === "year") {
      return { year: this.periodYear };
    }
    if (this.periodMode === "range") {
      if (!this.rangeStart || !this.rangeEnd) {
        return undefined;
      }
      return {
        start: calendarDayFromJsDate(this.rangeStart),
        end: calendarDayFromJsDate(this.rangeEnd),
      };
    }
    return { year: this.periodYear, month: this.periodMonth };
  }

  periodLabel(): string {
    return formatPeriodLabel(this.currentPeriod());
  }

  railWebsites(): NamedWebsite[] {
    const selectedTagList = this.allTags().filter((tag) => this.selectedTags[tag]);
    if (selectedTagList.length === 0) {
      return [];
    }
    return this.allWebsites().filter(({ website }) =>
      selectedTagList.some((tag) => website.tags.includes(tag)),
    );
  }

  displayName(name: string): string {
    const website = publicWebsites[name];
    return website ? websiteDisplayName(name, website) : name;
  }

  coverageLabel(name: string): string {
    const website = publicWebsites[name];
    return website ? formatCoverageLabel(websiteCoverage(website)) : "";
  }

  publicSummary(name: string): string {
    return publicWebsites[name]?.summary ?? "";
  }

  markdown(text: string): string {
    return converter.makeHtml(text);
  }

  supportsPeriod(name: string): boolean {
    const website = publicWebsites[name];
    return website ? websiteSupportsPeriod(website, this.currentPeriod()) : false;
  }

  isInWorkingSet(name: string): boolean {
    return this.workingSet().includes(name);
  }

  isVisible(name: string): boolean {
    return this.visibleSlots().includes(name);
  }

  isFocused(name: string): boolean {
    return this.visibleSlots()[this.focusedSlot()] === name;
  }

  visibleColumns(): string[] {
    return this.visibleSlots().filter((name): name is string => !!name);
  }

  columnCountClass(): string {
    return this.visibleColumns().length <= 1 ? "columns--single" : "columns--two";
  }

  stackFor(name: string): GeneratedURL[] {
    return this.stacks()[name] ?? [];
  }

  formatted(name: string, generated: GeneratedURL) {
    return formatGeneratedUrl(generated, name);
  }

  isSelected(name: string, index: number): boolean {
    const selected = this.selected();
    return !!selected && selected.site === name && selected.index === index;
  }

  selectedGenerated(): GeneratedURL | undefined {
    const selected = this.selected();
    if (!selected) {
      return undefined;
    }
    return this.stackFor(selected.site)[selected.index];
  }

  selectedFormatted() {
    const selected = this.selected();
    const generated = this.selectedGenerated();
    if (!selected || !generated) {
      return undefined;
    }
    return formatGeneratedUrl(generated, selected.site);
  }

  visibleUrlCount(): number {
    return this.visibleColumns().reduce((sum, name) => sum + this.stackFor(name).length, 0);
  }

  annotationFor(url: string): UrlAnnotation {
    return this.annotations()[url] ?? emptyAnnotation();
  }

  hasAnnotation(url: string): boolean {
    return !annotationIsEmpty(this.annotationFor(url));
  }

  selectedAnnotation(): UrlAnnotation {
    const url = this.selectedGenerated()?.url;
    return url ? this.annotationFor(url) : emptyAnnotation();
  }

  toggleTag(tag: string, checked: boolean) {
    this.selectedTags[tag] = checked;
  }

  toggleWorkingSet(name: string) {
    if (this.isInWorkingSet(name)) {
      this.removeFromWorkingSet(name);
      return;
    }
    if (!this.supportsPeriod(name)) {
      return;
    }
    this.workingSet.update((set) => [...set, name]);
    const slots = [...this.visibleSlots()] as [string | null, string | null];
    const emptyIndex = slots.findIndex((slot) => !slot);
    if (emptyIndex >= 0) {
      slots[emptyIndex] = name;
      this.visibleSlots.set(slots);
      this.focusedSlot.set(emptyIndex as 0 | 1);
      this.ensureStack(name);
    }
  }

  removeFromWorkingSet(name: string) {
    this.workingSet.update((set) => set.filter((entry) => entry !== name));
    const slots = this.visibleSlots().map((slot) => (slot === name ? null : slot)) as [
      string | null,
      string | null,
    ];
    const remaining = this.workingSet().filter((entry) => this.supportsPeriod(entry) && !slots.includes(entry));
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i] && remaining.length > 0) {
        slots[i] = remaining.shift() ?? null;
      }
    }
    this.visibleSlots.set(slots);
    if (slots[0]) {
      this.ensureStack(slots[0]);
    }
    if (slots[1]) {
      this.ensureStack(slots[1]);
    }
    const selected = this.selected();
    if (selected && !slots.includes(selected.site)) {
      this.clearSelection();
    }
  }

  activateChip(name: string) {
    if (!this.supportsPeriod(name)) {
      return;
    }
    if (!this.isInWorkingSet(name)) {
      this.workingSet.update((set) => [...set, name]);
    }
    if (this.isVisible(name)) {
      const index = this.visibleSlots().indexOf(name);
      if (index === 0 || index === 1) {
        this.focusedSlot.set(index);
      }
      return;
    }
    const slots = [...this.visibleSlots()] as [string | null, string | null];
    const emptyIndex = slots.findIndex((slot) => !slot);
    const target = emptyIndex >= 0 ? emptyIndex : this.focusedSlot();
    slots[target] = name;
    this.visibleSlots.set(slots);
    this.focusedSlot.set(target as 0 | 1);
    this.ensureStack(name);
  }

  onPeriodChange() {
    if (this.periodMode === "range") {
      this.ensureRangeDates();
      if (!this.rangeStart || !this.rangeEnd) {
        return;
      }
    }
    const slots = this.visibleSlots().map((name) =>
      name && this.supportsPeriod(name) ? name : null,
    ) as [string | null, string | null];
    const replacements = this.workingSet().filter(
      (name) => this.supportsPeriod(name) && !slots.includes(name),
    );
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i] && replacements.length > 0) {
        slots[i] = replacements.shift() ?? null;
      }
    }
    this.visibleSlots.set(slots);
    this.stacks.set({});
    this.clearSelection();
    this.compareResult.set(null);
    this.compareError.set("");
    this.refillVisibleColumns();
  }

  onRangeChange() {
    if (!this.rangeStart || !this.rangeEnd) {
      return;
    }
    this.onPeriodChange();
  }

  loadMore(name: string) {
    this.appendToStack(name, BATCH_SIZE);
  }

  shuffle(name: string) {
    const website = publicWebsites[name];
    if (!website) {
      return;
    }
    const urls = generateUrlBatch(website, BATCH_SIZE, this.currentPeriod());
    this.stacks.update((stacks) => ({ ...stacks, [name]: urls }));
    const selected = this.selected();
    if (selected?.site === name) {
      this.clearSelection();
    }
  }

  selectCard(name: string, index: number) {
    this.flushNotes();
    this.selected.set({ site: name, index });
    const slot = this.visibleSlots().indexOf(name);
    if (slot === 0 || slot === 1) {
      this.focusedSlot.set(slot);
    }
    this.chatMessages.set([]);
    this.chatInput = "";
    this.draftTagInput = "";
    this.draftNotes = this.selectedAnnotation().notes;
    this.scheduleBriefing();
  }

  openSelected() {
    const generated = this.selectedGenerated();
    if (generated) {
      this.openUrl(generated.url);
    }
  }

  openUrl(url: string) {
    window.api.sendToBackend.openUrlInBrowser({ url });
  }

  async copySelected() {
    const generated = this.selectedGenerated();
    if (!generated) {
      return;
    }
    try {
      await navigator.clipboard.writeText(generated.url);
      this.copied.set(true);
      if (this.copyTimer !== undefined) {
        clearTimeout(this.copyTimer);
      }
      this.copyTimer = setTimeout(() => this.copied.set(false), 1500);
    } catch (error) {
      console.error("Failed to copy URL:", error);
    }
  }

  async feelingLucky() {
    const candidates = this.visibleColumns().filter((name) => this.supportsPeriod(name));
    const pool = candidates.length > 0
      ? candidates
      : this.workingSet().filter((name) => this.supportsPeriod(name));
    if (pool.length === 0) {
      return;
    }
    const name = pool[Math.floor(Math.random() * pool.length)];
    const website = publicWebsites[name];
    const generated = website ? tryGenerateRandomURL(website, this.currentPeriod()) : null;
    if (!generated) {
      return;
    }
    this.activateChip(name);
    this.stacks.update((stacks) => ({
      ...stacks,
      [name]: [generated, ...(stacks[name] ?? [])],
    }));
    this.selectCard(name, 0);
    this.openUrl(generated.url);
    await this.briefThisUrl();
  }

  async briefThisUrl() {
    const generated = this.selectedGenerated();
    if (!generated || this.chatLoading()) {
      return;
    }
    const alreadyAsked = this.chatMessages().some(
      (message) => message.sender === "user" && message.content.type === "text" && message.content.text === URL_BRIEF_PROMPT,
    );
    if (!alreadyAsked) {
      this.chatMessages.update((messages) => [
        ...messages,
        { content: { type: "text", text: URL_BRIEF_PROMPT }, sender: "user" },
      ]);
    }
    await this.sendChat(false);
  }

  async sendMessage() {
    await this.sendChat(true);
  }

  attachGenerated() {
    const generated = this.selectedGenerated();
    if (!generated) {
      return;
    }
    this.chatLoading.set(true);
    window.api.sendToBackend.obtainUrlContent({
      generatedURL: generated,
      type: "downloadFromGeneratedURL",
    });
  }

  attachClipboard() {
    const generated = this.selectedGenerated();
    if (!generated) {
      return;
    }
    this.chatLoading.set(true);
    window.api.sendToBackend.obtainUrlContent({
      generatedURL: generated,
      type: "downloadFromURLInClipboard",
    });
  }

  attachScreenshot() {
    const generated = this.selectedGenerated();
    if (!generated) {
      return;
    }
    this.chatLoading.set(true);
    window.api.sendToBackend.obtainUrlContent({
      generatedURL: generated,
      type: "screenshotInClipboard",
    });
  }

  onNotesChange(value: string) {
    this.draftNotes = value;
    if (this.noteTimer !== undefined) {
      clearTimeout(this.noteTimer);
    }
    this.noteTimer = setTimeout(() => {
      this.noteTimer = undefined;
      void this.saveNotes();
    }, NOTE_SAVE_DEBOUNCE_MS);
  }

  addAnnotationTag() {
    const tag = this.draftTagInput.trim();
    if (!tag) {
      return;
    }
    this.draftTagInput = "";
    const current = this.selectedAnnotation();
    if (current.tags.includes(tag)) {
      return;
    }
    void this.commitAnnotation({
      ...current,
      notes: this.draftNotes,
      tags: [...current.tags, tag],
    });
  }

  removeAnnotationTag(tag: string) {
    const current = this.selectedAnnotation();
    void this.commitAnnotation({
      ...current,
      notes: this.draftNotes,
      tags: current.tags.filter((entry) => entry !== tag),
    });
  }

  async onScreenshotFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }
    try {
      await this.addScreenshot(await blobToDataUrl(file), file.name);
    } catch (error) {
      this.annotationSaveError.set(error instanceof Error ? error.message : String(error));
    }
  }

  async pasteScreenshot() {
    try {
      const items = await navigator.clipboard.read();
      const imageItem = items.find((item) => item.types.some((type) => type.startsWith("image/")));
      const type = imageItem?.types.find((entry) => entry.startsWith("image/"));
      if (!imageItem || !type) {
        this.annotationSaveError.set("No image found on the clipboard.");
        return;
      }
      const blob = await imageItem.getType(type);
      await this.addScreenshot(await blobToDataUrl(blob), `clipboard.${type.split("/")[1] ?? "png"}`);
    } catch (error) {
      this.annotationSaveError.set(
        error instanceof Error ? error.message : "Could not read an image from the clipboard.",
      );
    }
  }

  removeScreenshot(id: string) {
    const current = this.selectedAnnotation();
    void this.commitAnnotation({
      ...current,
      notes: this.draftNotes,
      screenshots: current.screenshots.filter((shot) => shot.id !== id),
    });
  }

  async compareVisible() {
    const items = this.visibleColumns().flatMap((name) =>
      this.stackFor(name).map((generated) => ({
        siteName: this.displayName(name),
        generated,
        annotation: this.hasAnnotation(generated.url) ? this.annotationFor(generated.url) : undefined,
      })),
    );
    if (items.length === 0 || this.compareLoading()) {
      return;
    }
    this.compareLoading.set(true);
    this.compareError.set("");
    try {
      const truncated = items.length > MAX_COMPARE_URLS;
      const text = await compareVisibleUrls(
        truncated ? items.slice(0, MAX_COMPARE_URLS) : items,
        this.periodLabel(),
      );
      this.compareResult.set(
        truncated
          ? `${text}\n\n_Only the first ${MAX_COMPARE_URLS} visible URLs were sent to the model._`
          : text,
      );
    } catch (error) {
      this.compareError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.compareLoading.set(false);
    }
  }

  dismissCompare() {
    this.compareResult.set(null);
    this.compareError.set("");
  }

  renderMessage(message: ChatMessage): string {
    if (message.type === "text") {
      return converter.makeHtml(message.text ?? "");
    }
    if (message.type === "file") {
      return `Attached file: ${message.file?.name ?? "file"}`;
    }
    return "";
  }

  imageSrc(message: ChatMessage): string | undefined {
    if (message.type !== "image" || !message.image) {
      return undefined;
    }
    const bytes = new Uint8Array(message.image);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:image/png;base64,${window.btoa(binary)}`;
  }

  downloadType() {
    return this.selectedGenerated()?.website.downloadType;
  }

  private async sendChat(includeInput: boolean) {
    const generated = this.selectedGenerated();
    if (!generated) {
      return;
    }
    if (includeInput && this.chatInput.trim()) {
      const text = this.chatInput.trim();
      this.chatInput = "";
      this.chatMessages.update((messages) => [
        ...messages,
        { content: { type: "text", text }, sender: "user" },
      ]);
    }
    this.chatLoading.set(true);
    try {
      const response = await window.api.invokeFromBackend.explainUrl({
        url: generated,
        messages: this.chatMessages(),
      });
      this.chatMessages.update((messages) => [
        ...messages,
        { content: { type: "text", text: response }, sender: "assistant" },
      ]);
    } catch (error) {
      this.chatMessages.update((messages) => [
        ...messages,
        {
          content: {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
          sender: "assistant",
        },
      ]);
    } finally {
      this.chatLoading.set(false);
    }
  }

  private ensureStack(name: string) {
    if ((this.stacks()[name] ?? []).length > 0) {
      return;
    }
    this.appendToStack(name, BATCH_SIZE);
  }

  private appendToStack(name: string, count: number) {
    const website = publicWebsites[name];
    if (!website) {
      return;
    }
    const urls = generateUrlBatch(website, count, this.currentPeriod());
    this.stacks.update((stacks) => ({
      ...stacks,
      [name]: [...(stacks[name] ?? []), ...urls],
    }));
  }

  private refillVisibleColumns() {
    for (const name of this.visibleColumns()) {
      this.ensureStack(name);
    }
  }

  private clearSelection() {
    this.flushNotes();
    this.selected.set(null);
    this.chatMessages.set([]);
    this.chatInput = "";
    this.draftNotes = "";
    this.draftTagInput = "";
    this.periodBriefing.set(null);
    this.periodBriefingError.set("");
    this.periodBriefingLoading.set(false);
    this.briefingRequestId += 1;
  }

  private ensureRangeDates() {
    if (!this.rangeStart) {
      this.rangeStart = jsDateFromCalendarDay({
        year: this.periodYear,
        month: this.periodMonth,
        day: 1,
      });
    }
    if (!this.rangeEnd) {
      this.rangeEnd = jsDateFromCalendarDay({ year: 1969, month: 9, day: 30 });
    }
  }

  private flushNotes() {
    if (this.noteTimer !== undefined) {
      clearTimeout(this.noteTimer);
      this.noteTimer = undefined;
      void this.saveNotes();
    }
  }

  private async saveNotes() {
    const current = this.selectedAnnotation();
    if (!this.selectedGenerated()) {
      return;
    }
    await this.commitAnnotation({ ...current, notes: this.draftNotes });
  }

  private async addScreenshot(dataUrl: string, name: string) {
    const shot: UrlScreenshot = {
      id: screenshotId(),
      name,
      dataUrl,
      addedAt: Date.now(),
    };
    const current = this.selectedAnnotation();
    await this.commitAnnotation({
      ...current,
      notes: this.draftNotes,
      screenshots: [...current.screenshots, shot],
    });
  }

  private async commitAnnotation(annotation: UrlAnnotation) {
    const url = this.selectedGenerated()?.url;
    if (!url) {
      return;
    }
    const nextStore: UrlAnnotationStore = { ...this.annotations() };
    const toSave = { ...annotation, updatedAt: Date.now() };
    if (annotationIsEmpty(toSave)) {
      delete nextStore[url];
    } else {
      nextStore[url] = toSave;
    }
    this.annotations.set(nextStore);
    try {
      const result = await window.api.invokeFromBackend.saveUrlAnnotations(nextStore);
      if (result.ok === false) {
        this.annotationSaveError.set(result.error);
      } else {
        this.annotationSaveError.set("");
      }
    } catch (error) {
      this.annotationSaveError.set(error instanceof Error ? error.message : String(error));
    }
  }

  private scheduleBriefing() {
    if (this.briefingTimer !== undefined) {
      clearTimeout(this.briefingTimer);
    }
    this.periodBriefing.set(null);
    this.periodBriefingError.set("");
    const generated = this.selectedGenerated();
    const request = generated ? briefingRequestForUrl(generated) : undefined;
    if (!request) {
      this.periodBriefingLoading.set(false);
      return;
    }
    const requestId = ++this.briefingRequestId;
    this.periodBriefingLoading.set(true);
    this.briefingTimer = setTimeout(() => {
      void this.loadBriefing(request, requestId);
    }, BRIEFING_DEBOUNCE_MS);
  }

  private async loadBriefing(
    request: { year: number; month?: number; locale: string },
    requestId: number,
  ) {
    try {
      const text = await getPeriodBriefing(request);
      if (requestId !== this.briefingRequestId) {
        return;
      }
      this.periodBriefing.set(text);
      this.periodBriefingError.set("");
    } catch (error) {
      if (requestId !== this.briefingRequestId) {
        return;
      }
      this.periodBriefingError.set(error instanceof Error ? error.message : String(error));
    } finally {
      if (requestId === this.briefingRequestId) {
        this.periodBriefingLoading.set(false);
      }
    }
  }
}
