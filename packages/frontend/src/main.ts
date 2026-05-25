import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UrlGeneratorComponent } from './components/url-generator.component/url-generator.component';
import { WebsiteAnalyzerComponent } from './components/website-analyzer.component/website-analyzer.component';
import { ElectronService } from '@linkrandomizer/common';
import { FrontendUrlHandler } from './frontend-handler/frontend-url-handler';
import { FrontendWebsiteHandler } from './frontend-handler/frontend-website-handler';
import { FrontendService } from './frontend-handler/frontend-service';

if(window.isElectron){
  console.log("Running in electron");
} else {
  const service:ElectronService={
    invokeFromBackend:{
      ...FrontendUrlHandler.invokeFromBackend,
      ...FrontendWebsiteHandler.invokeFromBackend
    },
    eventFromBackend:{
      ...FrontendUrlHandler.eventFromBackend,
      ...FrontendWebsiteHandler.eventFromBackend
    },
    sendToBackend:{
      ...FrontendUrlHandler.sendToBackend,
      ...FrontendWebsiteHandler.sendToBackend
    }
  }
  window.api=service;
  console.log("Running in browser");
}





@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, UrlGeneratorComponent, WebsiteAnalyzerComponent]
})
class App implements OnInit {
  activeTab = 'generator';
  frontendService=inject(FrontendService);

  ngOnInit() {
    console.log('App initialized with IPC:', window.api);
  }
}

bootstrapApplication(App).catch(err => console.error(err));

