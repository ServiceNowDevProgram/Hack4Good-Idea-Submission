# How to Contribute

We welcome contributions to the **ServiceNow Developer Program's Hack4Good Ideation Portal Repository**! Follow these steps to get involved:

## Contributions for Hacktoberfest 2025
In Hacktoberfest 2025, we are looking for Proposal submissions only. When committed to source control, these are seen as `x_snc_hack4good_0_hack4good_proposal_{sys_id}.xml` files, where sys_id is the unique ID of the Hack4Good proposal record.

## Steps to Contribute

1. **Fork the Repository**: Click the "Fork" button on the top right of this page to create your own copy of the repository.

2. **Go to your ServiceNow instance**: Log in to your ServiceNow instance

3. **Optional - Create a credential for GitHub**: If you have not used Source Control in this instance before, create a credential as described by Earl [here](https://www.servicenow.com/community/developer-advocate-blog/source-control-in-servicenow-studio-complete-walkthrough/ba-p/3356303#create-a-credential-in-servicenow).

4. **Import Hack4Good-Idea-Submission into your instance**: Using a Source Control-enabled Studio, import your fork of this repository from source control using the `main` branch. Steps and compatible studios are listed below:
  - **Studios**:
    - On Zurich and above: `ServiceNow Studio`
    - On Yokohama and earlier: `App Engine Studio` or `Legacy Studio`
  - **Steps**:
    - [SNS Import Instructions](http://servicenow.com/docs/bundle/zurich-application-development/page/build/servicenow-studio/task/sns-sc-import-app-source-control.html)
    - [AES Import Instructions](http://servicenow.com/docs/bundle/yokohama-application-development/page/build/app-engine-studio/task/source-control-import.html)
    - [Legacy Studio Import Instructions](https://www.servicenow.com/docs/bundle/yokohama-application-development/page/build/applications/task/t_ImportAppFromSourceControl.html)

6. **Create a New Branch**: Using a Source Control-enabled studio, create a new branch and switch to it. Name your branch according to the functionality you are adding (e.g., `feature/new-snippet` or `bugfix/fix-issue`). Steps are listed below:
   - [SNS Create Branch Instructions](https://www.servicenow.com/docs/bundle/zurich-application-development/page/build/servicenow-studio/concept/sns-sc-create-versions-branches-git.html#title_sns-sc-create-repo-branch)
   - [AES Create Branch Instructions](https://www.servicenow.com/docs/bundle/yokohama-application-development/page/build/app-engine-studio/concept/create-versions-branches-git.html#title_source-control-create-branch)
   - [Legacy Studio Create Branch Instructions](https://www.servicenow.com/docs/bundle/yokohama-application-development/page/build/applications/task/t_CreateBranch.html)

7. **Go to the H4G portal**: Open `https://YOUR-INSTANCE.service-now.com/h4g` (replace `YOUR-INSTANCE` with your ServiceNow instance subdomain)
   - From there, you can jump straight into **submitting a new idea** (or just go straight to `https://YOUR-INSTANCE.service-now.com/h4g?id=idea_submission&sys_id=12da163393c832108543b2597bba107d`), check out submissions from the Community (make sure your fork is synced!) or return to this file.
   - Fill out the Idea Submission form with as many details as possible and click Submit. The confirmation screen will also have follow-up instructions in line with this file.

9. **Commit your contribution to Source Control**: Using a Source Control-enabled Studio, commit your changes to source control. Steps are listed below:
   - [SNS Commit Changes Instructions](https://www.servicenow.com/docs/bundle/zurich-application-development/page/build/servicenow-studio/task/sns-sc-commit-changes-to-repository.html)
   - [AES Commit Changes Instructions](https://www.servicenow.com/docs/bundle/yokohama-application-development/page/build/app-engine-studio/task/source-control-commit-changes.html)
   - [Legacy Studio Commit Changes Instructions](https://www.servicenow.com/docs/bundle/yokohama-application-development/page/build/applications/task/t_CommitChanges.html)

10. **Submit a Pull Request**: In your GitHub repository, submit a new pull request against the `main` branch of Hack4Good, from your fork and branch. Steps are listed below:
   - Go to the original repository and click on the "Pull Requests" tab.
   - Click "New Pull Request" and select your branch.
   - Ensure your pull request has a descriptive title and comment that outlines what changes you made.
   - Only include files relevant to the changes described in the pull request title and description. In this case, it should ideally just be `x_snc_hack4good_0_hack4good_proposal_{sys_id}.xml` file.
   - Avoid submitting XML exports of ServiceNow records independently.

That's it! A Developer Advocate or a designated maintainer from the ServiceNow Dev Program will review your pull request. If approved, it will be merged into the main repository for everyone's benefit (and then everyone can sync their fork again to have it included 😉)!

### Note on Multiple Submissions
If you plan to submit another pull request while your original is still pending, make sure to **create a new branch** in your forked repository first!

## General Requirements

- **Descriptive Pull Request Titles**: Your pull request must have explicit and descriptive titles that accurately represent the changes made.
- **Scope Adherence**: Changes that fall outside the described scope will result in the entire pull request being rejected.
- **Quality Over Quantity**: Low-effort or spam pull requests will be marked accordingly.


Thank you for contributing! Your efforts help create a richer resource for the ServiceNow development community.

