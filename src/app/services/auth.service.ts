import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap } from 'rxjs';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'author' | 'admin' | 'user';
}

export interface AuthResponse {
  token: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8000'; // Django backend port

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  register(userData: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/api/register/`, userData).pipe(
      tap(res => this.setToken(res.token))
    );
  }

  login(credentials: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/api/login/`, credentials).pipe(
      tap(res => this.setToken(res.token))
    );
  }

  getUserInfo(): Observable<User> {
    const token = this.getToken();
    return this.http.get<User>(`${this.apiUrl}/api/dashboard/`, {
      headers: { 'Authorization': `Token ${token}` }
    });
  }

  getBooks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/books`);
  }

  getRecommendations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/recommendations`);
  }

  getAuthorWork(authorId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/author/work?authorId=${authorId}`);
  }

  incrementViewCount(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/recommendations/${id}/view`, {});
  }

  uploadText(submission: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/upload-text`, submission);
  }

  setToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('auth_token', token);
    }
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
