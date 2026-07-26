import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Component, OnInit, signal } from '@angular/core';
import type { RegexWebsiteControllerDefinition } from '@linkrandomizer/common';

const emptyDraft = (): RegexWebsiteControllerDefinition => ({
  name: '',
  initialUrl: '',
  parentDomain: '',
  maxDepth: 2,
  canBeVisitedRegex: '',
  canBeReturnedRegex: '',
  requireUserAttentionRegex: '',
});

@Component({
  selector: 'app-website-analyzer',
  templateUrl: './website-analyzer.component.html',
  styleUrls: ['./website-analyzer.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class WebsiteAnalyzerComponent implements OnInit {
  isAnalyzing = false;
  numberOfUrls = signal<number>(0);
  statusMessage = signal<string>('Craft a regex controller or select saved ones to crawl.');
  formMessage = signal<string>('');

  savedControllers = signal<RegexWebsiteControllerDefinition[]>([]);
  selectedNames: Record<string, boolean> = {};

  draft: RegexWebsiteControllerDefinition = emptyDraft();

  ngOnInit() {
    (window as any).api.eventFromBackend.webSiteAnalysisStateChanged((state: number) => {
      this.numberOfUrls.set(state);
      if (this.isAnalyzing) {
        this.statusMessage.set('Crawling… use Play/Stop in the browser window to control the run.');
      }
    });
    (window as any).api.eventFromBackend.webSiteAnalysisFinished(() => {
      this.isAnalyzing = false;
      this.statusMessage.set('Crawl finished. Progress was saved.');
    });
    void this.refreshSavedControllers();
  }

  async refreshSavedControllers() {
    const list = await window.api.invokeFromBackend.listControllerDefinitions();
    this.savedControllers.set(list);
    const nextSelected: Record<string, boolean> = {};
    for (const def of list) {
      nextSelected[def.name] = this.selectedNames[def.name] ?? false;
    }
    this.selectedNames = nextSelected;
  }

  toggleSelected(name: string, checked: boolean) {
    this.selectedNames = { ...this.selectedNames, [name]: checked };
  }

  get selectedControllerNames(): string[] {
    return Object.entries(this.selectedNames)
      .filter(([, on]) => on)
      .map(([name]) => name);
  }

  loadIntoForm(def: RegexWebsiteControllerDefinition) {
    this.draft = { ...def };
    this.formMessage.set(`Loaded “${def.name}” into the editor.`);
  }

  resetForm() {
    this.draft = emptyDraft();
    this.formMessage.set('Form cleared.');
  }

  async saveController() {
    const result = await window.api.invokeFromBackend.saveControllerDefinition({ ...this.draft });
    if (result.ok === false) {
      this.formMessage.set(result.error);
      return;
    }
    this.formMessage.set(`Saved ${result.jsonPath} and ${result.jsPath}`);
    this.selectedNames = { ...this.selectedNames, [this.draft.name.trim()]: true };
    await this.refreshSavedControllers();
  }

  startAnalysisFromSelection() {
    const names = this.selectedControllerNames;
    if (names.length === 0) {
      this.statusMessage.set('Select at least one saved controller, or use Analyze from files.');
      return;
    }
    this.beginAnalysis({ controllerNames: names });
  }

  startAnalysisFromFiles() {
    this.beginAnalysis({ controllerNames: [], openFilePicker: true });
  }

  private beginAnalysis(data: { controllerNames: string[]; openFilePicker?: boolean }) {
    if (this.isAnalyzing) {
      return;
    }
    this.isAnalyzing = true;
    this.numberOfUrls.set(0);
    this.statusMessage.set(
      data.openFilePicker
        ? 'Pick controller JSON/JS file(s), then in the browser clear banners and click Play.'
        : 'Browser opening… clear cookie banners, then click Play to start.',
    );
    window.api.sendToBackend.setActive(true);
    window.api.sendToBackend.analyzeWebsite(data);
  }

  stopAnalysis() {
    if (!this.isAnalyzing) {
      return;
    }
    window.api.sendToBackend.setActive(false);
    this.isAnalyzing = false;
    this.statusMessage.set('Crawl stopped. Progress was saved.');
  }
}
