---
description: How to maintain documentation and commit code for the SwitchNest project
---

# Documentation & Commit Workflow

When I am asked to complete work and commit changes to the switch_v2 repository, I must always follow this workflow to ensure that the documentation suite remains synchronized and the static documentation website works perfectly.

1. **Rebuild Static Documentation:**
   Wait for any previous tools to complete.
   Navigate to the documentation directory and execute the node build script to bundle all markdown files into the `docs-data.js` file:
   ```bash
   cd c:\Users\robos\OneDrive\Documents\SwitchNest\documentation
   node build-data.js
   ```

2. **Verify Output:**
   Ensure that `docs-data.js` is generated and has a non-zero size.

3. **Stage UI Assets & Documentation:**
   Stage all modified documentation files, including the HTML, Markdown, and generated JS files. 

4. **Commit the Codebase:**
   Make the commit with a concise, descriptive message summarizing the codebase changes. Make sure to use standard commit format.
