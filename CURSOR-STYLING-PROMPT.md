# Cursor AI - Styling & Design Prompt for AIHP CrewTrack

## 🎨 CRITICAL: You MUST Apply Full Styling

When building ANY component for AIHP CrewTrack, you are REQUIRED to:

1. ✅ Read and follow **design_guidelines.md** completely
2. ✅ Use **Tailwind CSS** classes for ALL styling
3. ✅ Import and use **shadcn/ui components** from `@/components/ui/*`
4. ✅ Apply the complete design system (colors, typography, spacing)
5. ✅ Make it **mobile-responsive** with proper breakpoints
6. ✅ Include **dark mode support** where applicable

## 📋 Before You Code - Read These Files

**MUST READ in this order:**
1. `design_guidelines.md` - Complete design system
2. `CURSOR-AI-SPEC.md` - Technical architecture
3. `client/src/index.css` - CSS variables and custom styles

## 🎯 Styling Requirements Checklist

### Every Component Must Have:

- [ ] **Tailwind CSS classes** for all styling (NO inline styles)
- [ ] **shadcn/ui components** where applicable (Button, Card, Input, etc.)
- [ ] **Proper spacing** using Tailwind spacing scale (p-4, gap-6, etc.)
- [ ] **Typography** following design system (text-3xl font-bold, etc.)
- [ ] **Colors** from the design palette (not random colors)
- [ ] **Responsive design** (mobile-first approach)
- [ ] **Hover states** and interactions
- [ ] **Loading states** with skeletons or spinners
- [ ] **Icons** from lucide-react

### Example: Bad vs Good Code

❌ **BAD - Plain HTML with no styling:**
```tsx
<div>
  <h1>Dashboard</h1>
  <div>
    <p>Total Employees: 50</p>
  </div>
</div>
```

✅ **GOOD - Fully styled with Tailwind + shadcn:**
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

<div className="min-h-screen bg-slate-50 p-6 lg:p-8">
  <div className="max-w-screen-2xl mx-auto">
    <h1 className="text-3xl font-bold tracking-tight mb-8">Dashboard</h1>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Employees
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">50</div>
          <p className="text-xs text-muted-foreground mt-1">
            +12% from last month
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</div>
```

## 🎨 Design System Quick Reference

### Colors (Use Tailwind Classes)

**Backgrounds:**
- Login pages: `bg-gradient-to-br from-slate-900 to-slate-800`
- Dashboard: `bg-slate-50` or `bg-white`
- Cards: `bg-white border border-slate-200`

**Text:**
- Primary: `text-slate-900`
- Secondary: `text-slate-600` or `text-muted-foreground`
- Links: `text-blue-600 hover:text-blue-700`

**Buttons:**
- Primary: `bg-blue-600 hover:bg-blue-700 text-white`
- Secondary: `bg-slate-100 hover:bg-slate-200 text-slate-900`
- Destructive: `bg-red-600 hover:bg-red-700 text-white`

**Status Colors:**
- Success: `text-green-600 bg-green-50`
- Warning: `text-amber-600 bg-amber-50`
- Error: `text-red-600 bg-red-50`
- Info: `text-blue-600 bg-blue-50`

### Typography Scale

```tsx
// Page titles
<h1 className="text-3xl font-bold tracking-tight">

// Section headers
<h2 className="text-xl font-semibold">

// Card titles
<h3 className="text-base font-medium">

// Body text
<p className="text-sm">

// Small text / captions
<span className="text-xs text-muted-foreground">

// Large metrics
<div className="text-2xl font-bold tabular-nums">
```

### Layout & Spacing

```tsx
// Container
<div className="max-w-screen-2xl mx-auto px-4 lg:px-8">

// Grid layouts
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

// Flex layouts
<div className="flex items-center justify-between gap-4">

// Card padding
<Card className="p-6">

// Section spacing
<div className="space-y-6">
```

### Mobile Responsive Patterns

```tsx
// Mobile-first responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

// Responsive text
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">

// Hide on mobile, show on desktop
<div className="hidden lg:block">

// Show on mobile, hide on desktop
<div className="block lg:hidden">
```

## 📦 shadcn/ui Components to Use

### Import from `@/components/ui/*`

**Common Components:**
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
```

**Icons from lucide-react:**
```tsx
import { Users, MapPin, Clock, AlertCircle, CheckCircle, XCircle, Menu, X, Search, Bell, Settings } from "lucide-react";
```

## 🏗️ Page Structure Template

Every page should follow this structure:

```tsx
export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo-192.png" alt="AIHP CrewTrack" className="h-8" />
            <h1 className="text-lg font-semibold">AIHP CrewTrack</h1>
          </div>
          
          <nav className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Avatar>
              <AvatarImage src="/avatar.jpg" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of your workforce</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Cards go here */}
        </div>
      </main>
    </div>
  );
}
```

## 🎯 Login Page Example (Dark Gradient Background)

```tsx
export default function AdminLogin() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white shadow-2xl">
        <CardHeader className="text-center pb-2">
          <img 
            src="/logo-192.png" 
            alt="AIHP CrewTrack" 
            className="h-12 mx-auto mb-4"
          />
          <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
          <p className="text-muted-foreground text-sm">
            Sign in to manage your workforce
          </p>
        </CardHeader>
        
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="admin@company.com"
                        className="h-10"
                        {...field} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter your password"
                        className="h-10"
                        {...field} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 h-10"
              >
                Sign In
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

## 🔄 Loading States

Always show loading states:

```tsx
// Card skeleton
{isLoading ? (
  <Card className="p-6">
    <Skeleton className="h-8 w-24 mb-4" />
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-3/4" />
  </Card>
) : (
  <Card>
    {/* Actual content */}
  </Card>
)}

// Table skeleton
{isLoading ? (
  <div className="space-y-2">
    {[...Array(5)].map((_, i) => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
) : (
  <Table>
    {/* Actual table */}
  </Table>
)}
```

## 📱 Mobile Navigation

```tsx
// Bottom mobile navigation
<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 lg:hidden">
  <nav className="flex items-center justify-around h-16">
    <Button variant="ghost" className="flex flex-col items-center gap-1">
      <Home className="h-5 w-5" />
      <span className="text-xs">Dashboard</span>
    </Button>
    <Button variant="ghost" className="flex flex-col items-center gap-1">
      <Users className="h-5 w-5" />
      <span className="text-xs">Employees</span>
    </Button>
    <Button variant="ghost" className="flex flex-col items-center gap-1">
      <MapPin className="h-5 w-5" />
      <span className="text-xs">Map</span>
    </Button>
    <Button variant="ghost" className="flex flex-col items-center gap-1">
      <Settings className="h-5 w-5" />
      <span className="text-xs">Settings</span>
    </Button>
  </nav>
</div>
```

## ⚠️ Common Mistakes to Avoid

❌ **DON'T:**
- Use inline styles: `<div style={{ color: 'red' }}>`
- Use plain HTML elements without classes: `<button>Click</button>`
- Forget responsive breakpoints: `<div className="grid-cols-4">`
- Use random colors: `bg-[#ff0000]`
- Skip loading states
- Forget mobile optimization

✅ **DO:**
- Use Tailwind classes: `<div className="text-red-600">`
- Use shadcn components: `<Button>Click</Button>`
- Add responsive breakpoints: `<div className="grid-cols-1 md:grid-cols-2 lg:grid-cols-4">`
- Use design system colors: `bg-blue-600`
- Always show loading/skeleton states
- Test on mobile sizes

## 🚀 Final Checklist Before Submitting Code

- [ ] All components use Tailwind CSS classes
- [ ] shadcn/ui components imported and used correctly
- [ ] Follows design_guidelines.md color palette
- [ ] Typography scale matches design system
- [ ] Mobile-responsive (tested at 375px, 768px, 1024px, 1920px)
- [ ] Loading states implemented
- [ ] Icons from lucide-react
- [ ] Proper spacing (gap-4, gap-6, p-4, p-6)
- [ ] Hover states on interactive elements
- [ ] Login pages have dark gradient backgrounds
- [ ] Dashboard pages have light backgrounds
- [ ] All images use proper paths (@assets/ or /public/)

---

## 💬 How to Use This Prompt

**Give Cursor AI this command:**

```
Read CURSOR-STYLING-PROMPT.md and design_guidelines.md completely.

From now on, when building ANY component for AIHP CrewTrack:
1. Apply FULL Tailwind CSS styling to every element
2. Use shadcn/ui components from @/components/ui/*
3. Follow the exact design system in design_guidelines.md
4. Make it mobile-responsive with proper breakpoints
5. Include loading states with Skeleton components
6. Use lucide-react icons
7. Follow the color palette and typography scale
8. NEVER generate plain HTML without styling

Show me example code for [specific component you want] with complete styling.
```

---

**This ensures Cursor generates production-ready, fully-styled code that matches your existing application design!**
