# FET Web - Free Educational Timetabling Software

A modern web-based timetabling software built with React, TypeScript, and modern web technologies. This is a port of the original FET (Free Timetabling Software) C++ application.

## Features

- **PWA Support**: Works offline with full Progressive Web App capabilities
- **Modern UI**: Built with ShadCN UI components and Tailwind CSS
- **Local Storage**: Uses IndexedDB via Dexie.js for in-browser data persistence
- **State Management**: Redux Toolkit for global state and RTK Query for queries
- **Import/Export**: Support for FET .fet XML file format

## Tech Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **State Management**: Redux Toolkit + RTK Query
- **Database**: Dexie.js (IndexedDB wrapper)
- **UI Components**: ShadCN UI + Radix UI
- **Styling**: Tailwind CSS
- **PWA**: vite-plugin-pwa + Workbox

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # ShadCN UI components
│   └── Layout.tsx      # Main layout component
├── db/                  # Dexie database setup
├── features/           # Feature-specific components
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
│   ├── engine/         # Timetable generation engine
│   ├── fetParser.ts    # FET file parser
│   └── utils.ts        # Utility functions
├── pages/              # Page components
├── store/              # Redux store
│   ├── slices/         # Redux slices
│   └── api.ts          # RTK Query API
├── types/              # TypeScript type definitions
└── App.tsx             # Main application component
```

## Core Concepts

### Entities

- **Teachers**: Instructors who teach activities
- **Subjects**: Courses/subjects being taught
- **Students**: Organized in Years > Groups > Subgroups hierarchy
- **Activities**: Lessons linking teachers, subjects, and students
- **Rooms**: Physical spaces where activities take place
- **Buildings**: Groups of rooms

### Constraints

- **Time Constraints**: Rules about when activities can be scheduled
  - Teacher/student not available times
  - Break times
  - Activity preferred times
  - Min/max days between activities
  
- **Space Constraints**: Rules about where activities can be scheduled
  - Room availability
  - Activity preferred rooms
  - Teacher/student home rooms

## Generation Algorithm

The timetable generation uses a recursive swapping algorithm based on the original FET implementation:

1. **Sort activities** by difficulty (most constrained first)
2. **For each activity**, find an available time slot:
   - If a slot is available without conflicts, use it
   - Otherwise, use recursive swapping to temporarily displace conflicting activities
3. **Recursive swapping**:
   - Place activity at best available slot
   - For each displaced activity, recursively find new placements
   - Use tabu list to avoid cycles
   - Backtrack if no solution found

## Importing FET Files

The application can import .fet XML files from the original FET software:

1. Go to Settings
2. Click "Import .FET"
3. Select your .fet file

## License

This project follows the same license as the original FET software - GNU Affero General Public License v3.

## Credits

Based on the original FET (Free Timetabling Software) by Liviu Lalescu.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
