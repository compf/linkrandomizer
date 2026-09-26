import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Component, OnInit, signal } from '@angular/core';
import type { ControllerAssistMessage, InducedSchemaRecord, RegexWebsiteControllerDefinition } from '@linkrandomizer/common';

const emptyDraft = (): RegexWebsiteControllerDefinition => ({
  name: '',
  initialUrl: '',
  parentDomain: '',
  maxDepth: 2,
  canBeVisitedRegex: '',
  canBeReturnedRegex: '',
  requireUserAttentionRegex: '',
  sitemapUrl: '',
  feedUrl: '',
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

  crawledSites = signal<{ name: string; urlCount: number }[]>([]);
  inducedSchemas = signal<InducedSchemaRecord[]>([]);
  inducingSite = signal<string | null>(null);
  schemeMessage = signal<string>('');

  draft: RegexWebsiteControllerDefinition = emptyDraft();

  assistUrl = '';
  assistInstruction = '';
  assistHistory: ControllerAssistMessage[] = [];
  assistBusy = signal(false);
  assistError = signal('');
  assistReasoning = signal('');
  assistSampleVisited = signal<string[]>([]);
  assistSampleReturned = signal<string[]>([]);

  resetAssistant() {
    this.assistUrl = '';
    this.assistInstruction = '';
    this.assistHistory = [];
    this.assistError.set('');
    this.assistReasoning.set('');
    this.assistSampleVisited.set([]);
    this.assistSampleReturned.set([]);
  }

  async runAssistant() {
    const startUrl = this.assistUrl.trim();
    if (!startUrl) {
      this.assistError.set('Enter a start URL first.');
      return;
    }
    if (this.assistBusy()) {
      return;
    }
    const instruction = this.assistInstruction.trim();
    this.assistBusy.set(true);
    this.assistError.set('');
    try {
      const result = await window.api.invokeFromBackend.proposeController({
        startUrl,
        instruction,
        history: this.assistHistory,
      });
      if (result.ok === false) {
        this.assistError.set(result.error);
        return;
      }
      this.assistHistory = [
        ...this.assistHistory,
        { role: 'user', content: instruction || 'Propose a controller for this site.' },
        { role: 'assistant', content: result.assistantMessage },
      ];
      this.assistReasoning.set(result.reasoning);
      this.assistSampleVisited.set(result.sampleVisited);
      this.assistSampleReturned.set(result.sampleReturned);
      this.draft = { ...result.proposal };
      this.assistInstruction = '';
      this.formMessage.set(`AI proposal for “${result.proposal.name}” loaded into the editor.`);
    } catch (error) {
      this.assistError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.assistBusy.set(false);
    }
  }

  ngOnInit() {
    (window as any).api.eventFromBackend.webSiteAnalysisStateChanged((state: number) => {
      this.numberOfUrls.set(state);
      if (this.isAnalyzing) {
        this.statusMessage.set('Crawling… a browser window opens only when a site needs manual help.');
      }
    });
    (window as any).api.eventFromBackend.webSiteAnalysisFinished(() => {
      this.isAnalyzing = false;
      this.statusMessage.set('Crawl finished. Progress was saved.');
      void this.refreshSchemes();
    });
    void this.refreshSavedControllers();
    void this.refreshSchemes();
  }

  async refreshSchemes() {
    try {
      this.crawledSites.set(await window.api.invokeFromBackend.listCrawledSites());
      this.inducedSchemas.set(await window.api.invokeFromBackend.listInducedSchemas());
    } catch (error) {
      console.error('Error loading crawled sites/schemas:', error);
    }
  }

  schemeFor(site: string): InducedSchemaRecord | undefined {
    return this.inducedSchemas().find((record) => record.site === site);
  }

  /** Only offer harvesting for hybrid schemes that verification did not refute. */
  canHarvest(site: string): boolean {
    const scheme = this.schemeFor(site);
    return scheme?.kind === 'hybrid' && (scheme.hitRate === null || scheme.hitRate > 0);
  }

  async proposeScheme(site: string) {
    this.inducingSite.set(site);
    this.schemeMessage.set(`Analyzing URL structure of “${site}”…`);
    try {
      const result = await window.api.invokeFromBackend.induceSchema({ site });
      if (result.ok === false) {
        this.schemeMessage.set(result.error);
      } else {
        const rate = result.record.hitRate === null ? 'unverified' : `${(result.record.hitRate * 100).toFixed(0)}% verified`;
        this.schemeMessage.set(`“${site}” classified as ${result.record.kind} (${rate}). ${result.record.reasoning}`);
      }
    } catch (error) {
      this.schemeMessage.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.inducingSite.set(null);
      await this.refreshSchemes();
    }
  }

  harvest(site: string) {
    if (this.isAnalyzing) {
      return;
    }
    this.isAnalyzing = true;
    this.numberOfUrls.set(0);
    this.statusMessage.set(`Harvesting “${site}” from its index scheme…`);
    window.api.sendToBackend.harvestSite({ site });
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
        ? 'Pick controller JSON/JS file(s); crawling starts over HTTP, a browser opens only if needed.'
        : 'Crawling over HTTP… a browser window opens only if a site needs manual help (then click Play).',
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
