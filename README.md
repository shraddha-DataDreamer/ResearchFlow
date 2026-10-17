ResearchFlow — An Intelligent Research Paper Navigation and Discovery System

ResearchFlow is a web-based academic research platform designed to help users discover, analyze, compare, and organize research papers in one place.

🌐 Live Demo

Live Website: https://researchflow-j3etmekbi-shraddha-datadreamers-projects.vercel.app

🎯 Project Objectives

- Discover relevant research papers.
- Analyze and understand research papers.
- Explore citations and research connections.
- Compare multiple research papers.
- Organize saved papers in a personal workspace.
- Support a more structured academic research workflow.

✨ Key Modules

- Paper Discovery: Search for research papers.
- Paper Analysis: Review and understand paper content.
- Citation Exploration: Explore citation relationships.
- Paper Comparison: Compare multiple research papers.
- Research Workspace: Organize and access saved research.
- Research Matrix and Gap Analysis: Support structured review of research topics.
- Research Journey and Alerts: Help organize research exploration and updates.

Feature availability depends on the current implementation.

🛠️ Technology Stack

- Next.js and React
- TypeScript
- Supabase
- External academic research APIs, as configured in the project

🚀 Access

Visit the live website using the link above. Some features may require an account.

🎓 Academic Project

ResearchFlow is a final-year BE Information Technology project developed as an academic team project.

📌 Repository

This repository contains the source code and project files for ResearchFlow.

## Feature Status

| Feature | Status |
|---------|--------|
| Landing page | Complete |
| Authentication | Complete |
| Dashboard | Complete |
| Paper Discovery (OpenAlex) | Complete |
| Paper Details | Complete |
| Saved Papers | Complete |
| Notes | Complete |
| Reading Lists | Complete |
| Settings/Profile | Complete |
| AI Paper Analysis (Extractive) | Complete |
| PDF Upload & Text Extraction | Complete |
| PDF Q&A (Keyword RAG) | Complete |
| Paper Comparison + CSV | Complete |
| Citation Explorer | Complete |
| Literature Matrix + CSV | Complete |
| Research Journey Map | Complete |
| Topic Alerts (Manual) | Complete |
| Semantic Embeddings | Planned |
| AI Provider Integration | Planned |
| Interactive Citation Graph | Planned |
| Scheduled Alerts | Planned |

## Project Structure

```
app/
  (app)/           — Authenticated app routes (dashboard, discover, workspace, etc.)
  login/           — Login page
  signup/          — Signup page
  forgot-password/ — Password reset request
  layout.tsx       — Root layout with AuthProvider
  page.tsx         — Landing page
components/
  ui/              — shadcn/ui components
  app-sidebar.tsx  — Collapsible sidebar navigation
  app-topnav.tsx   — Top navigation with search and profile menu
lib/
  auth-context.tsx — Auth provider and useAuth hook
  services/        — API service functions (search, pdf, analysis, citations)
  supabase/        — Supabase client instances
types/
  index.ts         — Shared TypeScript types
supabase/
  migrations/      — Database migrations (3 migrations)
  functions/       — Edge functions (scholarly-search)
  config.toml      — Supabase configuration
```



