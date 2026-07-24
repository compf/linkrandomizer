import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectModule } from "@angular/material/select";
import { MatIconModule } from "@angular/material/icon";
import { MatCardModule } from "@angular/material/card";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import {
  Website,
  GeneratedURL,
  generateRandomURL,
  publicWebsites,
  loadExtractedUrls,
  getTagsForWebsites,
  ItemRanker,
  RankerName,
  createRanker,
  rankerNames,
  sortUrls,
  defaultDateProximityConfig,
  defaultTagRankerConfig,
} from "@linkrandomizer/common";
import { ChatDialogComponent } from "../chat.component/chat.component";
import { Component, inject, OnInit, signal } from '@angular/core';

type NamedWebsite = { name: string; website: Website };

export type WebsiteTile = {
  name: string;
  website: Website;
  urls: GeneratedURL[];
};

@Component({
  selector: 'app-url-generator',
  templateUrl: './url-generator.component.html',
  styleUrls: ['./url-generator.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    MatCardModule,
    MatExpansionModule,
    MatCheckboxModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ]
})
export class UrlGeneratorComponent implements OnInit {
  allWebsites = signal<NamedWebsite[]>([]);
  allTags = signal<string[]>([]);
  selectedTags: { [key: string]: boolean } = {};
  selectedWebsites: Record<string, boolean> = {};
  urlCount = 1000;
  websiteTiles = signal<WebsiteTile[]>([]);

  protected rankerNames = rankerNames;
  selectedRankerName: RankerName = "No ranking";
  targetYear = defaultDateProximityConfig().targetYear;
  targetMonth = defaultDateProximityConfig().targetMonth ?? 1;
  tagPriority: string[] = [];
  aiPreferences = "";
  aiRankTarget: "url" | "website" | "both" = "both";
  aiRankScript = "";
  aiRankLoading = false;
  aiRankError = "";

  private dialog = inject(MatDialog);
  private ranker: ItemRanker = createRanker("No ranking");

  get tileColumnCount(): number {
    const count = this.websiteTiles().length;
    if (count <= 0) {
      return 1;
    }
    return Math.min(count, 4);
  }

  get selectedWebsiteCount(): number {
    return this.visibleWebsites().filter(({ name }) => this.selectedWebsites[name]).length;
  }

  async ngOnInit() {
    await this.loadWebsites();
    await this.loadTags();

    for (const tag of this.allTags()) {
      this.selectedTags[tag] = true;
    }
    this.tagPriority = [...this.allTags()];
    this.ranker = this.buildRanker();
    await this.generateUrls();
  }

  async loadWebsites() {
    try {
      await loadExtractedUrls();
      const namedWebsites = Object.entries(publicWebsites).map(([name, website]) => ({
        name,
        website,
      }));
      this.allWebsites.set(namedWebsites);
      for (const { name } of namedWebsites) {
        this.selectedWebsites[name] = true;
      }
    } catch (error) {
      console.error('Error loading websites:', error);
    }
  }

  visibleWebsites(): NamedWebsite[] {
    const selectedTagList = Object.keys(this.selectedTags).filter(tag => this.selectedTags[tag]);
    if (selectedTagList.length === 0) {
      return [];
    }
    return this.allWebsites().filter(({ website }) =>
      selectedTagList.some(tag => website.tags.includes(tag)),
    );
  }

  async toggleTagFilter(tag: string, isChecked: boolean) {
    this.selectedTags[tag] = isChecked;
  }

  async toggleWebsiteFilter(name: string, isChecked: boolean) {
    this.selectedWebsites[name] = isChecked;
  }

  selectAllWebsites() {
    for (const { name } of this.visibleWebsites()) {
      this.selectedWebsites[name] = true;
    }
  }

  clearAllWebsites() {
    for (const { name } of this.visibleWebsites()) {
      this.selectedWebsites[name] = false;
    }
  }

  refreshUrls() {
    void this.generateUrls();
  }

  async loadTags() {
    try {
      const websites: Website[] = Object.values(publicWebsites);
      this.allTags.set(getTagsForWebsites(websites));
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  filterNamedWebsites(): NamedWebsite[] {
    const selectedTagList = Object.keys(this.selectedTags).filter(tag => this.selectedTags[tag]);
    if (selectedTagList.length === 0) {
      return [];
    }

    return this.allWebsites().filter(({ name, website }) =>
      this.selectedWebsites[name] &&
      selectedTagList.some(tag => website.tags.includes(tag)),
    );
  }

  async generateUrls() {
    try {
      console.log("started generating URLs with count per website:", this.urlCount);
      const filteredWebsites = this.filterNamedWebsites();
      if (filteredWebsites.length === 0) {
        this.websiteTiles.set([]);
        return;
      }

      this.ranker = this.buildRanker();
      const tiles: WebsiteTile[] = filteredWebsites.map(({ name, website }) => {
        const urls: GeneratedURL[] = [];
        for (let i = 0; i < this.urlCount; i++) {
          urls.push(generateRandomURL(website));
        }
        return {
          name,
          website,
          urls: sortUrls(urls, this.ranker),
        };
      });

      tiles.sort((left, right) => {
        if (this.ranker.rankWebsite) {
          return this.ranker.rankWebsite(right.website) - this.ranker.rankWebsite(left.website);
        }
        return left.name.localeCompare(right.name);
      });

      console.log("Generated website tiles:", tiles.length);
      this.websiteTiles.set(tiles);
    } catch (error) {
      console.error("Error generating URLs:", error);
    }
  }

  protected changeRanker(name: RankerName) {
    this.selectedRankerName = name;
  }

  protected onRankingConfigChange() {
    // Ranking config is applied on the next refresh.
  }

  protected moveTagUp(index: number) {
    if (index <= 0) {
      return;
    }
    const next = [...this.tagPriority];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    this.tagPriority = next;
  }

  protected moveTagDown(index: number) {
    if (index >= this.tagPriority.length - 1) {
      return;
    }
    const next = [...this.tagPriority];
    [next[index + 1], next[index]] = [next[index], next[index + 1]];
    this.tagPriority = next;
  }

  protected async generateAiRanker() {
    if (!this.aiPreferences.trim()) {
      this.aiRankError = "Describe what you want to rank first.";
      return;
    }

    this.aiRankLoading = true;
    this.aiRankError = "";
    try {
      this.aiRankScript = await window.api.invokeFromBackend.generateRankScript({
        preferences: this.aiPreferences,
        target: this.aiRankTarget,
      });
      this.selectedRankerName = "AI custom";
      await this.generateUrls();
    } catch (error) {
      this.aiRankError = error instanceof Error ? error.message : String(error);
    } finally {
      this.aiRankLoading = false;
    }
  }

  private buildRanker(): ItemRanker {
    return createRanker(this.selectedRankerName, {
      dateProximity: {
        targetYear: this.targetYear,
        targetMonth: this.targetMonth,
      },
      tagPriority: defaultTagRankerConfig(this.tagPriority),
      ai: {
        script: this.aiRankScript,
        target: this.aiRankTarget,
      },
    });
  }

  displayLabel(generated: GeneratedURL): string {
    const entries = Object.entries(generated.variables);
    if (entries.length === 0) {
      return generated.url;
    }
    return entries
      .map(([key, value]) => `${key}: ${this.formatVariableValue(value)}`)
      .join(" · ");
  }

  private formatVariableValue(value: unknown): string {
    if (value == null) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  openUrl(url: string) {
    (window as any).api.sendToBackend.openUrlInBrowser({ url });
  }

  openChatDialog(url: GeneratedURL) {
    console.log("Opening chat dialog for URL:", url);
    this.dialog.open(ChatDialogComponent, {
      data: url
    });
  }

  randomUrl() {
    const tiles = this.websiteTiles();
    const allUrls = tiles.flatMap(tile => tile.urls);
    if (allUrls.length === 0) {
      return;
    }
    const picked = allUrls[Math.floor(Math.random() * allUrls.length)];
    this.openUrl(picked.url);
    this.openChatDialog(picked);
  }
}
