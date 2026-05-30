import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Component, inject, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-website-analyzer',
  templateUrl: './website-analyzer.component.html',
  styleUrls: ['./website-analyzer.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class WebsiteAnalyzerComponent implements OnInit {
  websiteUrl = '';
  isAnalyzing = false;


  obtainedUrls = signal<string[]>([]);
  numberOfUrls = signal<number>(0);
  maxDepth = 3;
  canBeVisitedRegex = '';
  canBeReturnedRegex = '';
  ngOnInit() {
    (window as any).api.eventFromBackend.webSiteAnalysisStateChanged((state: number) => {
      this.numberOfUrls.set(state);
    });
  }

  analyzeWebsite() {
  
      window.api.sendToBackend.setActive(!this.isAnalyzing);
      this.isAnalyzing=!this.isAnalyzing;
      window.api.sendToBackend.analyzeWebsite({ url: this.websiteUrl, maxDepth: this.maxDepth, canBeVisitedRegex: this.canBeVisitedRegex, canBeReturnedRegex: this.canBeReturnedRegex });
    
  }
}