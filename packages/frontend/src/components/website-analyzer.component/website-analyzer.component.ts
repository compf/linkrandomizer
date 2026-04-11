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
  analysisStatus = '';
  analyzedSchemas: any[] = [];

  ngOnInit() {
    (window as any).api.eventFromBackend.websiteAnalysisComplete((schemas: any[]) => {
      this.analyzedSchemas = schemas;
      this.isAnalyzing = false;
      this.analysisStatus = 'Complete';
    });

    (window as any).api.eventFromBackend.websiteAnalysisStatus((status: string) => {
      this.analysisStatus = status;
      if (status === 'analysis_started') {
        this.isAnalyzing = true;
      }
      if (status === 'analysis_done' || status === 'analysis_error') {
        this.isAnalyzing = false;
      }
    });
  }

  analyzeWebsite() {
    if (this.websiteUrl) {
      this.isAnalyzing = true;
      this.analysisStatus = 'Sending request...';
     window.api.sendToBackend.analyzeWebsite({ url: this.websiteUrl, existingLinks: [] });
    }
  }

  getSchemaPreview(schema: any): string {
    // Simple preview of the schema
    return schema.schema.map((part: any) => typeof part === 'string' ? part : `{${part.variable}}`).join('');
  }
}