import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GitHubWrappedComponent } from './components/github-wrapped/github-wrapped.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,GitHubWrappedComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'wrapped-github';
}
