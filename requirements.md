# Requirements Document: Stego PDF Editor v2

## Introduction

Stego PDF Editor v2 is an AI-native student productivity platform that transforms PDFs into interactive, intelligent study environments. The system integrates an AI assistant directly into the document viewing experience, enabling students to read, annotate, and receive AI assistance without context switching. The platform uses advanced steganographic techniques to embed rich contextual data (text, images, audio) within PDF metadata, creating a persistent, intelligent study workspace.

## Glossary

- **System**: The Stego PDF Editor v2 application
- **PDF_Canvas**: The left-side document viewing area displaying the PDF
- **Chatbot**: The right-side AI assistant interface
- **Context_Marker**: An interactive visual node pinned to specific PDF coordinates that serves as an AI context anchor
- **Snipping_Tool**: The drag-select interface for capturing PDF content
- **Context_Tag**: Metadata attached to snipped content identifying its source location
- **Floating_Menu**: The add-marker interface supporting text, image, and audio inputs
- **Deep_Context_Scan**: Background processing system that extracts embedded steganographic data
- **Steganographic_Data**: Information embedded in PDF using binary object steganography, GZIP compression, Base64 encoding, or audio metadata
- **Persistent_Context**: All currently opened documents, uploads, and user selections maintained in AI memory
- **Academic_Workspace**: The unified interface combining PDF viewing and AI assistance

## Requirements

### Requirement 1: Split-View Layout

**User Story:** As a student, I want to view my PDF and interact with the AI simultaneously, so that I can study without switching between applications.

#### Acceptance Criteria

1. THE System SHALL display a split-view interface with PDF_Canvas on the left and Chatbot on the right
2. WHEN the user resizes the window, THE System SHALL maintain the split-view proportions responsively
3. THE System SHALL allow users to adjust the divider between PDF_Canvas and Chatbot
4. WHEN a PDF is loaded, THE System SHALL render it in the PDF_Canvas while keeping the Chatbot accessible

### Requirement 2: Persistent Contextual Memory

**User Story:** As a student, I want the AI to automatically remember all my opened documents and selections, so that I don't have to repeatedly provide context.

#### Acceptance Criteria

1. WHEN a PDF is opened, THE System SHALL add it to Persistent_Context automatically
2. WHEN a user uploads additional PDFs, images, or audio files, THE System SHALL add them to Persistent_Context
3. WHEN a user makes a selection in the PDF_Canvas, THE System SHALL add it to Persistent_Context
4. THE Chatbot SHALL have access to all items in Persistent_Context for every query
5. WHEN a document is closed, THE System SHALL remove it from Persistent_Context

### Requirement 3: Interactive Context Markers

**User Story:** As a student, I want to place visual markers on my PDF that the AI understands, so that I can reference specific document locations in my conversations.

#### Acceptance Criteria

1. THE System SHALL allow users to create Context_Marker instances at specific PDF coordinates
2. WHEN a Context_Marker is created, THE System SHALL render a glowing visual node at the specified coordinates
3. WHEN a user clicks a Context_Marker, THE System SHALL add its associated content to Persistent_Context
4. THE System SHALL persist Context_Marker positions and content across sessions
5. WHEN a Context_Marker is referenced in chat, THE System SHALL highlight it in the PDF_Canvas

### Requirement 4: Core Snipping Tool

**User Story:** As a student, I want to drag-select content from my PDF and instantly discuss it with the AI, so that I can quickly get explanations without manual copying.

#### Acceptance Criteria

1. WHEN a user drags to select content in PDF_Canvas, THE Snipping_Tool SHALL capture the selected region
2. WHEN content is snipped, THE System SHALL extract text and visual data from the selection
3. WHEN content is snipped, THE System SHALL create a Context_Tag with the exact PDF coordinates
4. WHEN content is snipped, THE System SHALL inject it into the Chatbot with the Context_Tag attached
5. THE System SHALL support snipping both text and visual elements

### Requirement 5: Floating Add-Marker Menu

**User Story:** As a student, I want to add text notes, images, and voice recordings to my PDF, so that I can enrich my study materials with multiple content types.

#### Acceptance Criteria

1. WHEN a user invokes the add-marker action, THE System SHALL display the Floating_Menu
2. THE Floating_Menu SHALL provide options for text notes, image uploads, and voice recordings
3. WHEN a text note is created, THE System SHALL create a Context_Marker with the text content
4. WHEN an image is uploaded, THE System SHALL create a Context_Marker with the image data
5. WHEN a voice recording is captured, THE System SHALL create a Context_Marker with the audio data
6. THE System SHALL index all Floating_Menu content into the AI's understanding

### Requirement 6: Deep Context Scan - Steganographic Embedding

**User Story:** As a student, I want my annotations and context to be embedded within the PDF itself, so that my enriched study materials are portable and self-contained.

#### Acceptance Criteria

1. WHEN Context_Marker data is saved, THE System SHALL embed it using binary object steganography
2. WHEN text content exceeds a size threshold, THE System SHALL compress it using GZIP before embedding
3. WHEN image data is embedded, THE System SHALL encode it using Base64
4. WHEN audio data is embedded, THE System SHALL store it in PDF metadata
5. THE System SHALL maintain PDF visual integrity while embedding Steganographic_Data

### Requirement 7: Deep Context Scan - Extraction

**User Story:** As a student, I want the AI to automatically discover and understand all embedded content in my PDFs, so that I can seamlessly continue my work across sessions.

#### Acceptance Criteria

1. WHEN a PDF is opened, THE Deep_Context_Scan SHALL execute in the background
2. THE Deep_Context_Scan SHALL extract binary object steganography from the PDF
3. THE Deep_Context_Scan SHALL decompress GZIP-compressed text content
4. THE Deep_Context_Scan SHALL decode Base64-encoded images
5. THE Deep_Context_Scan SHALL extract audio memos from PDF metadata
6. WHEN extraction completes, THE System SHALL add all extracted content to Persistent_Context

### Requirement 8: Zero Tab-Switching Workflow

**User Story:** As a student, I want to read, annotate, and get AI assistance all in one place, so that I can maintain focus and avoid workflow interruptions.

#### Acceptance Criteria

1. THE System SHALL provide all core functionality within the Academic_Workspace
2. THE System SHALL not require external applications for PDF viewing, annotation, or AI interaction
3. WHEN a user performs any study task, THE System SHALL keep them within the Academic_Workspace
4. THE System SHALL maintain continuous workflow without navigation to external tabs or windows

### Requirement 9: PDF Rendering and Navigation

**User Story:** As a student, I want to navigate and view my PDFs clearly, so that I can read and study effectively.

#### Acceptance Criteria

1. THE System SHALL render PDF pages with high fidelity in the PDF_Canvas
2. THE System SHALL support page navigation (next, previous, jump to page)
3. THE System SHALL support zoom controls (zoom in, zoom out, fit to width, fit to page)
4. WHEN a user scrolls, THE System SHALL update the visible page smoothly
5. THE System SHALL display page numbers and total page count

### Requirement 10: Chatbot Interaction

**User Story:** As a student, I want to have natural conversations with the AI about my study materials, so that I can deepen my understanding.

#### Acceptance Criteria

1. THE Chatbot SHALL accept text input from users
2. WHEN a user submits a query, THE Chatbot SHALL process it with access to Persistent_Context
3. THE Chatbot SHALL display responses in a conversational format
4. THE Chatbot SHALL support multi-turn conversations with context retention
5. WHEN the Chatbot references specific content, THE System SHALL provide visual indicators in the PDF_Canvas

### Requirement 11: Data Persistence

**User Story:** As a student, I want my annotations and context markers to be saved, so that I can continue my work across sessions.

#### Acceptance Criteria

1. WHEN a user creates or modifies Context_Marker instances, THE System SHALL persist them to storage
2. WHEN a user reopens a PDF, THE System SHALL restore all Context_Marker instances
3. THE System SHALL embed Context_Marker data within the PDF file itself
4. WHEN a PDF with embedded data is opened on a different device, THE System SHALL extract and restore all Context_Marker instances
5. THE System SHALL handle concurrent modifications to prevent data loss

### Requirement 12: Audio Recording

**User Story:** As a student, I want to record voice notes directly in the application, so that I can capture verbal thoughts without external tools.

#### Acceptance Criteria

1. WHEN a user selects voice recording from Floating_Menu, THE System SHALL request microphone permissions
2. WHEN recording starts, THE System SHALL capture audio from the microphone
3. WHEN recording stops, THE System SHALL save the audio data
4. THE System SHALL support playback of recorded audio
5. THE System SHALL display recording duration during capture
