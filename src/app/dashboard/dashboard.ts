import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  user: User | null = null;
  books: any[] = [];
  recommendations: any[] = [];
  authorWork: any = null;
  loading = true;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadDashboardData();
  }

  private loadDashboardData() {
    this.authService.getUserInfo().subscribe({
      next: (user) => {
        this.user = user;
        this.loadBooks();
        this.loadRecommendations();
        if (user.role === 'author') {
          this.loadAuthorWork();
        }
      },
      error: () => {
        this.authService.logout();
        this.router.navigate(['/login']);
      }
    });
  }

  private loadBooks() {
    this.authService.getBooks().subscribe({
      next: (books) => {
        this.books = books;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private loadRecommendations() {
    this.authService.getRecommendations().subscribe({
      next: (recs) => {
        this.recommendations = recs;
      },
      error: () => {
        // ignore errors for recommendations
      }
    });
  }

  private loadAuthorWork() {
    if (!this.user) return;
    this.authService.getAuthorWork(this.user.id).subscribe({
      next: (work) => {
        this.authorWork = work;
      },
      error: () => {
        console.error('Failed to load author work');
      }
    });
  }

  trackView(id: number) {
    this.authService.incrementViewCount(id).subscribe({
      next: () => {
        this.loadAuthorWork(); // Refresh counts if author
      }
    });
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
