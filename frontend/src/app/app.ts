import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface RagResponse {
  answer: string;
  sources: string[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected title = 'Gallery RAG';
  question = '';
  response = signal<RagResponse | undefined>(undefined);
  loading = signal(false);

  async askQuestion(event: Event) {
    event.preventDefault();
    if (!this.question.trim()) return;
    this.loading.set(true);
    this.response.set(undefined);
    try {
      const res = await fetch('http://localhost:3000/artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: this.question })
      });
      const data = await res.json();
      this.response.set(data);
    } catch (e) {
      this.response.set({ answer: 'Error contacting backend.', sources: [] });
    } finally {
      this.loading.set(false);
    }
  }
}
