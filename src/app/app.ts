// import { Component, signal } from '@angular/core';
// import { RouterOutlet } from '@angular/router';

// @Component({
//   selector: 'app-root',
//   imports: [RouterOutlet],
//   templateUrl: './app.html',
//   styleUrl: './app.css'
// })
// export class App {
//   protected readonly title = signal('jarvis_bot');
// }
import { Component } from '@angular/core';
import { SnakeGame } from './snake-game/snake-game';

@Component({
  selector: 'app-root',
  imports: [SnakeGame],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}