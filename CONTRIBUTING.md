 # Contributing to mosaic-cli

 Thank you for your interest in contributing to `mosaic-cli`. This document explains how to set up your environment, propose changes, and submit pull requests.

 ## Ways to contribute

 - **Report bugs**: Use the GitHub Issues tab and include steps to reproduce, expected behavior, and environment details.
 - **Suggest enhancements**: Open an issue describing the problem you want to solve and your proposed solution.
 - **Submit code changes**: Fix bugs, improve performance, or add features through pull requests.
 - **Improve documentation**: Clarify existing docs or add new ones where needed.

 ## Code of Conduct

 By participating in this project, you agree to always be respectful and constructive. Please keep discussions technical and inclusive.

 ## Getting started

 1. **Fork** the repository on GitHub.
 2. **Clone** your fork:

    ```bash
    git clone https://github.com/<your-username>/mosaic-cli.git
    cd mosaic-cli
    ```

 3. **Install dependencies** with your preferred package manager, for example:

    ```bash
    npm install
    ```

 4. **Create a branch** for your work:

    ```bash
    git checkout -b feature/my-change
    ```

 ## Development guidelines

 - **Keep changes focused**: Prefer small, self-contained pull requests.
 - **Maintain compatibility**: Avoid breaking changes unless discussed in an issue first.
 - **Follow existing style**: Match the existing TypeScript and project style (formatting, naming, folder structure).
 - **Add tests**: When fixing a bug or adding a feature, add or update tests where it makes sense.

 ### Commit messages

 Use clear, descriptive commit messages. A good pattern is:

 - **Short summary** in the imperative mood (for example, `Fix CLI config loading`)
 - Optionally, a longer description explaining the motivation and approach

 If you are comfortable with it, you may follow the Conventional Commits style (for example, `feat: add new init subcommand` or `fix: handle missing config file`).

 ### Code style

 - Use TypeScript for application code.
 - Prefer existing utilities and patterns over introducing new ones without discussion.
 - Keep functions small and focused.
 - Write clear, self-explanatory names; avoid abbreviations that are not widely known.

 ## Running tests

 Before opening a pull request:

 - **Run the test suite** locally using the appropriate command for this project (for example `npm test` or an equivalent script).
 - **Add or update tests** so that new behavior is covered.
 - Ensure all tests pass and there are no obvious TypeScript or lint errors.

 ## Documentation changes

 - Keep the documentation concise and accurate.
 - Update any relevant docs when behavior or configuration changes.
 - For larger documentation additions, consider opening an issue or draft pull request first to discuss structure and scope.

 ## Pull request process

 1. Ensure your branch is up to date with the default branch (for example `main`).
 2. Verify that tests pass and your changes build successfully.
 3. Open a pull request on GitHub and include:
    - **What** you changed.
    - **Why** you changed it (link to issues if applicable).
    - **How** you tested it.
 4. Be ready to respond to review comments and make follow-up changes.

 Once your pull request is approved and all checks pass, a maintainer will merge it. Thank you again for contributing to `mosaic-cli`.