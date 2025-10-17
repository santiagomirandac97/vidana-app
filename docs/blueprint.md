# **App Name**: ReceptionRGSTR

## Core Features:

- Employee Number Input: Auto-focus input field for quick employee number entry, optimized for scanner input and manual typing.
- Company Selector: Dropdown menu to select the company (Inditex, Grupo Axo, Vidana). Defaults to Inditex.
- Employee Lookup & Consumption Logging: Upon entering employee number, check local storage (and optionally backend) for existing employee. Logs consumption if found; prompts for quick activation if not.
- Quick Employee Activation: If an employee is not found, provide a quick activation form with prefilled Number, Name, and selected Company.
- Feedback Messages: Display success, warning, and error messages based on the action outcome, including a 'Today count' for successful log.
- CSV Import/Export: Enable importing employee data from CSV files (per company) and exporting consumptions within a specified date range and company.
- Consumption Reports: Generate reports with total consumptions and unique employee counts within a date range and company.

## Style Guidelines:

- Primary color: Forest green (#38A3A5) for success and a welcoming feel, reflecting the reception environment.
- Background color: Light beige (#F5F5DC) provides a high-contrast, soft background that's easy on the eyes.
- Accent color: Soft amber (#FFC133), is analogous to the primary and is for 'unknown' statuses or actions that require attention. Also include a red color (#F2542D) for error messages.
- Font: 'Inter', a grotesque-style sans-serif font, will be used for the entire interface, suitable for headlines and body text, creating a neutral and readable experience. 
- High-contrast, responsive layout optimized for laptops and tablets, with large, readable text for ease of use.
- Simple, clear icons to represent actions and status, ensuring quick understanding at a glance.
- Subtle animations (e.g., a brief highlight) upon successful actions to provide clear visual feedback without being distracting.