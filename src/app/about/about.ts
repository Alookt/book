import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  imports: [],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  about: string = "I wanted this web app to be a library where creators could meet their audience fast with zero publisher cost. This is going to be such an adventure for every adventurer out there. I hope to gather all books even rare books, but seeing ai need for human literature hope to make this the final frontier of electronic human creativity.From the beginning of speech to the evolving of writing i accept all languages and so to our readers if the author accepts their work to be translated or is afraid of the originality outcome might have no translate button but if the author agrees to the editing of their work then we place the translate button, hope to make every evolved form of writing the earth has to offer, hope the users find it well.I had a vision of the last frontier of last human writing and so, for the users' sake I will read through every text before landing on to the platform and to the authors there is a linkbutton at the top linking to the database.I hope you will all enjoy this";

  part: string[] = [];
  textColor = '#d66a11';

  constructor() {
    this.part = this.about.split('.').map(sent => {
      return sent.endsWith('.') ? sent : sent + '.';
    })
  }
}
