import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Sparkles, ChevronRight, Moon, Sun, Crown } from 'lucide-react';
import Dashboard from './components/Dashboard';
import { useTheme } from './context/ThemeContext';
import { cn } from './utils';
import { useSupabaseData } from './hooks/useSupabaseData';

// Feature Card
const FeatureCard = ({ icon: Icon, title, description }) => {
  const { theme } = useTheme();
  
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={cn(
        "p-8 border transition-all duration-300 group",
        theme === 'light' 
          ? "bg-white border-stone-200 hover:border-stone-400 hover:shadow-lg" 
          : "bg-stone-900/50 border-stone-800 hover:border-gold-500/30 hover:bg-stone-900"
      )}
    >
      <div className={cn(
        "w-12 h-12 flex items-center justify-center mb-6 transition-colors",
        theme === 'light' ? "bg-stone-100 text-stone-900" : "bg-stone-800 text-gold-500"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className={cn(
        "text-xl font-serif font-bold mb-3",
        theme === 'light' ? "text-stone-900" : "text-stone-50"
      )}>{title}</h3>
      <p className={cn(
        "leading-relaxed",
        theme === 'light' ? "text-stone-600" : "text-stone-400"
      )}>{description}</p>
    </motion.div>
  );
};

// Login Page
function LoginPage({ onLogin }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={cn(
      "min-h-screen flex flex-col items-center justify-center transition-colors duration-500 font-sans selection:bg-gold-500/30",
      theme === 'light' ? "bg-stone-50 text-stone-900" : "bg-stone-950 text-stone-50"
    )}>
       <div className="flex absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          className={cn(
            "p-2 rounded-full transition-colors",
            theme === 'light' ? "hover:bg-stone-200 text-stone-600" : "hover:bg-stone-800 text-stone-400"
          )}
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </div>

      <div className="w-full max-w-md p-8 text-center space-y-8">
        <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           className="flex flex-col items-center gap-4"
        >
          <div className={cn(
            "w-16 h-16 flex items-center justify-center rounded-2xl shadow-2xl skew-y-3",
            theme === 'light' ? "bg-stone-900 text-gold-500" : "bg-stone-800 text-gold-500"
          )}>
            <Crown className="w-8 h-8" />
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Family Manager</h1>
          <p className={cn("text-sm uppercase tracking-widest", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
             Premium Dashboard
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "p-8 border shadow-xl rounded-none space-y-6",
            theme === 'light' ? "bg-white border-stone-200" : "bg-stone-900 border-stone-800"
          )}
        >
           <div className="space-y-2">
             <h2 className={cn("font-serif text-xl font-bold", theme === 'light' ? "text-stone-900" : "text-stone-50")}>
               Welcome Back
             </h2>
             <p className={cn("text-sm", theme === 'light' ? "text-stone-500" : "text-stone-400")}>
               Sign in to manage your premium accounts
             </p>
           </div>

           <button
             onClick={onLogin}
             className={cn(
               "w-full group relative flex items-center justify-center gap-3 px-6 py-4 font-bold rounded-none text-xs uppercase tracking-widest transition-all hover:-translate-y-1 shadow-lg",
               theme === 'light' 
                 ? "bg-stone-900 text-stone-50 hover:bg-stone-800" 
                 : "bg-white text-stone-950 hover:bg-stone-200"
             )}
           >
             <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
             </svg>
             Continue with Google
           </button>
        </motion.div>
        
        <p className={cn("text-xs opacity-50", theme === 'light' ? "text-stone-400" : "text-stone-600")}>
          By continuing, you agree to our Terms of Service & Privacy Policy.
        </p>
      </div>
    </div>
  );
}

// Main App
function App() {
  const [session, setSession] = useState(null);
  const { signInWithGoogle } = useSupabaseData();
  
  // Note: we're using a simple session check here. 
  // In a real app we'd likely expose the session from useSupabaseData nicely
  // But for now, we rely on the component mount logic in Dashboard or similar.
  // Actually, to make the Login Page switch to Dashboard, we need to know auth state.
  
  // Let's hook into Supabase Auth directly here for the router
  React.useEffect(() => {
    import('./supabaseClient').then(({ supabase }) => {
       if(supabase) {
           supabase.auth.getSession().then(({ data: { session } }) => {
             setSession(session);
           });
    
           const {
             data: { subscription },
           } = supabase.auth.onAuthStateChange((_event, session) => {
             setSession(session);
           });
           return () => subscription.unsubscribe();
       }
    });
  }, []);


  if (!session) {
    return <LoginPage onLogin={signInWithGoogle} />;
  }

  return <Dashboard key={session.user.id} />;
}

export default App;
