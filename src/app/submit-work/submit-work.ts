import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-submit-work',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './submit-work.html',
  styleUrl: './submit-work.css',
})
export class SubmitWork implements OnInit {
  user: User | null = null;
  submission = {
    author: '',
    authorId: 0,
    text: '',
    format: 'text',
    threeDObject: ''
  };
  message = '';
  loading = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.authService.getUserInfo().subscribe({
      next: (user) => {
        this.user = user;
        this.submission.author = `${user.first_name} ${user.last_name}`;
        this.submission.authorId = user.id;
      },
      error: () => this.router.navigate(['/login'])
    });
  }

  onSubmit() {
    this.loading = true;
    this.authService.uploadText(this.submission).subscribe({
      next: (res: any) => {
        this.message = res.message;
        this.submission.text = '';
        this.submission.threeDObject = '';
        this.loading = false;
      },
      error: (err) => {
        this.message = 'Submission failed. Please try again.';
        this.loading = false;
      }
    });
  }
}
