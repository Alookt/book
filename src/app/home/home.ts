import { AfterViewInit, Component, ElementRef, inject, PLATFORM_ID, OnDestroy, ViewChild } from '@angular/core';
import { initBookScene } from './book-scene.js';
import { isPlatformBrowser } from '@angular/common';
@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home implements AfterViewInit, OnDestroy {
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  private platformId = inject(PLATFORM_ID);
  private disposeScene?: () => void;

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)){
      this.disposeScene = initBookScene(this.containerRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.disposeScene?.();
  }
}
