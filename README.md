# Freetown UrbanAI Frontend

Freetown UrbanAI is an early-stage civic AI assistant prototype for municipal planning, environmental policy, and urban resilience workflows.

The frontend provides a policy-team interface for querying urban planning and environmental materials, uploading technical documents, and supporting faster review of fragmented evidence in data-poor city government contexts.

## Purpose

Municipal policy teams often work across scattered planning documents, environmental reports, infrastructure files, spreadsheets, and partner deliverables. Freetown UrbanAI explores how a lightweight AI interface can help public-sector teams ask better questions of those materials and convert technical evidence into usable policy insight.

The project is grounded in Freetown City Council use cases, including:

- urban planning and area action planning
- air quality and environmental policy review
- infrastructure and service-delivery evidence
- climate resilience and informal settlement upgrading
- document ingestion for policy and technical materials

This repository contains the frontend application. It is designed to connect to an external workflow that handles document ingestion, retrieval, and AI response generation.

## Current Features

- React and TypeScript interface for an urban policy AI assistant
- Chat interface for policy and planning queries
- Document upload panel for technical files such as PDF, CSV, JSON, DWG, DXF, and SHP
- Freetown-focused dashboard panels for city metrics, live environment indicators, and planning-team context
- External workflow integration for chat and file ingestion
- Vite-based local development workflow

## Tech Stack

- React 19
- TypeScript
- Vite
- Three.js
- External AI workflow integration through HTTP endpoints

## Repository Scope

This repository is intended to be a reusable frontend template for civic AI and municipal policy workflows. It does not include confidential city documents, private policy drafts, or production secrets.

Before deploying or making a fork public, review all configured backend endpoints and environment-specific settings.

## Local Development

Prerequisites:

- Node.js
- npm

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Configuration Notes

The frontend currently expects external workflow endpoints for:

- chat responses
- file upload and document ingestion

For public or production use, these endpoints should be moved into environment variables and configured per deployment environment. Do not commit API keys, private tokens, confidential documents, or sensitive operational URLs.

## Maintainer Roadmap

Near-term priorities:

- move backend workflow URLs into environment variables
- add source-grounded response metadata and citations
- improve upload validation and error handling
- add regression tests for chat and upload flows
- document a safe local setup path for contributors
- separate mock city indicators from live integrations
- improve accessibility and mobile responsiveness

## Open Source Direction

The long-term goal is to make Freetown UrbanAI a practical open-source civic AI template for city teams, researchers, and public-sector technologists working with fragmented urban planning and environmental evidence.

The project is especially relevant for cities where analytical capacity is limited, data is incomplete, and policy teams need tools that help them validate, retrieve, and interpret technical information without replacing human judgment.
