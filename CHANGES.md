# Developer Mode — Integration Patch Notes

All new files go into the repo as-is. For the three existing files below,
apply the described diffs. Every change is additive — nothing is removed.

---

## 1. src/main.jsx — import dev CSS (dev builds only)

Add **after** the last existing CSS import:

```js
// Dev-mode styles — tree-shaken by Vite in production
if (import.meta.env.DEV) {
  import('./styles/dev-mode.css');
}
```

---

## 2. src/App.jsx — wrap tree in DevProvider

```diff
 import { BrowserRouter, Routes, Route } from 'react-router-dom';
 import { AuthProvider } from './context/AuthContext';
 import { ThemeProvider } from './context/ThemeContext';
 import { ToastProvider } from './context/ToastContext';
+import { DevProvider } from './context/DevContext';
 import Layout from './components/Layout';
 ...

 export default function App() {
   return (
     <ThemeProvider>
       <ToastProvider>
         <AuthProvider>
+          <DevProvider>
             <BrowserRouter>
               <Routes>
                 ...
               </Routes>
             </BrowserRouter>
+          </DevProvider>
         </AuthProvider>
       </ToastProvider>
     </ThemeProvider>
   );
 }
```

---

## 3. src/components/Layout.jsx — add DevFloatingButton

```diff
+import DevFloatingButton from './dev/DevFloatingButton';

 export default function Layout() {
   ...
   return (
     <div className="app-shell">
       <ScreenSaver />
       <Sidebar ... />
       <div className="app-main">
         <Header ... />
         <div className="page-content">
           <ErrorBoundary>
             <Outlet />
           </ErrorBoundary>
         </div>
         <Footer />
       </div>
+      {import.meta.env.DEV && <DevFloatingButton />}
     </div>
   );
 }
```

---

## 4. src/components/Sidebar.jsx — add DevConsole at the bottom

```diff
+import DevConsole from './dev/DevConsole';

 export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
   ...
   return (
     <>
       <aside className={...}>
         ...
         <div className="sidebar-footer">
+          {import.meta.env.DEV && <DevConsole collapsed={collapsed} />}
           {canInstall && ( ... )}
           ...
         </div>
       </aside>
       ...
     </>
   );
 }
```
