import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Component, OnInit, signal } from '@angular/core';

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
  statusMessage = signal<string>('Select one or more website controllers to crawl. Requests alternate between sites.');

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
  }

  startAnalysis() {
    if (this.isAnalyzing) {
      return;
    }
    this.isAnalyzing = true;
    this.numberOfUrls.set(0);
    this.statusMessage.set(
      'Pick controller file(s), then in the browser clear cookie banners and click Play to start.',
    );
    window.api.sendToBackend.setActive(true);
    window.api.sendToBackend.analyzeWebsite({
      url: '',
      maxDepth: 3,
      canBeVisitedRegex: '',
      canBeReturnedRegex: '',
    });
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
