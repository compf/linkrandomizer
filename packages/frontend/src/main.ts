import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UrlGeneratorComponent } from './components/url-generator.component/url-generator.component';
import { WebsiteAnalyzerComponent } from './components/website-analyzer.component/website-analyzer.component';






@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, UrlGeneratorComponent, WebsiteAnalyzerComponent]
})
class App implements OnInit {
  activeTab = 'generator';

  ngOnInit() {
    console.log('App initialized with IPC:', window.api);
  }
}

bootstrapApplication(App).catch(err => console.error(err));
