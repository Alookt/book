import { Routes } from '@angular/router';
import { Home } from './home/home'; 
import { About } from './about/about';
import { Register } from './register/register';
import { Login } from './login/login';

export const routes: Routes = [
    {path: '', component: Home},
    {path: 'about', component: About},
    {path: 'register', component: Register},
    {path: 'login', component: Login},
];
