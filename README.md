# Eyes-On-Screen Proctored Quiz

A sophisticated client-side web application that provides real-time proctoring capabilities for online assessments using computer vision and machine learning.

## Features

- **Privacy-First Design**: All video processing occurs locally in the browser
- **Real-time Monitoring**: 30-60 Hz monitoring with multi-signal cheat detection
- **Advanced Computer Vision**: MediaPipe FaceMesh integration for precise face tracking
- **Personalized Calibration**: Custom calibration for optimal accuracy
- **Comprehensive Detection**: Eyes-off-screen, head pose, environment, and device detection
- **Accessibility Compliant**: Full keyboard navigation and screen reader support

## Project Structure

```
src/
├── app/                    # Next.js app router pages
├── components/             # React components
│   ├── ui/                # Reusable UI components
│   ├── quiz/              # Quiz-specific components
│   ├── calibration/       # Calibration wizard components
│   └── monitoring/        # Real-time monitoring components
├── lib/                   # Core business logic modules
│   ├── vision/            # Computer vision processing
│   ├── proctoring/        # Monitoring and alert systems
│   ├── quiz/              # Quiz logic and management
│   ├── calibration/       # Calibration algorithms
│   └── data/              # Data persistence and export
├── store/                 # Zustand state management
├── utils/                 # Utility functions and constants
└── types/                 # Global TypeScript definitions
```

## Technology Stack

- **Framework**: Next.js 15 with TypeScript
- **Computer Vision**: MediaPipe FaceMesh
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Data Storage**: IndexedDB
- **Performance**: WebAssembly optimizations

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Core Modules

### Vision Module (`/src/lib/vision/`)
- Face detection and landmark tracking
- Gaze estimation and head pose calculation
- Environment analysis and secondary object detection
- Temporal filtering and signal processing

### Proctoring Module (`/src/lib/proctoring/`)
- Real-time monitoring orchestration
- Multi-signal decision making
- Tiered alert system
- Risk score calculation

### Quiz Module (`/src/lib/quiz/`)
- Quiz logic and timing
- Academic integrity enforcement
- Answer collection and validation
- Accessibility features

### Calibration Module (`/src/lib/calibration/`)
- Personalized gaze calibration
- Head pose boundary detection
- Environment baseline establishment
- Quality assessment and feedback

### Data Module (`/src/lib/data/`)
- Local data persistence with IndexedDB
- Export functionality (JSON, CSV, PDF)
- Optional server synchronization
- Privacy-compliant data handling

## Performance Targets

- **Frame Rate**: ≥24 FPS (target 30 FPS)
- **CPU Usage**: <60% of one mid-range core
- **Memory Usage**: <300MB
- **Latency**: <50ms processing time per frame

## Browser Support

- Chrome 90+
- Edge 90+
- Safari 14+
- Firefox 88+

## Privacy & Security

- All video processing occurs client-side
- No raw video data transmitted to servers
- Optional audit log upload with explicit consent
- Local data encryption and secure deletion
- GDPR and privacy regulation compliant

## Development

This project follows a modular architecture with clear separation of concerns. Each module has its own types, interfaces, and implementation files. The codebase is designed for maintainability, testability, and performance.

For detailed implementation specifications, see the design document in `.kiro/specs/eyes-on-screen-proctored-quiz/design.md`.
