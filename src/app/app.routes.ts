import { Routes } from '@angular/router';
import { Home } from './home/home';
import { About } from './about/about';
import { Register } from './register/register';
import { Login } from './login/login';
import { Dashboard } from './dashboard/dashboard';
import { SubmitWork } from './submit-work/submit-work';
import { authGuard } from './auth.guard';

export const routes: Routes = [
    {path: '', component: Home},
    {path: 'about', component: About},
    {path: 'register', component: Register},
    {path: 'login', component: Login},
    {path: 'dashboard', component: Dashboard, canActivate: [authGuard]},
    {path: 'submit-work', component: SubmitWork, canActivate: [authGuard]},
];
