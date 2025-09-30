![Hack4Good](hack4goodbanner.png)

A ServiceNow app to capture ideas for developing solutions as part of the Hack4Good initiative. This repository enables the ServiceNow community to submit innovative project proposals aimed at creating positive social impact through technology.

> Interested in our other ServiceNow Hacktoberfest projects? See the main repository [here](https://github.com/ServiceNowDevProgram/Hacktoberfest) or see our official blog post [here](https://devlink.sn/hacktoberfest).

## A Special Partnership: Hack4Good

We are thrilled to announce that we are partnering with our friends at Hack4Good!

Typically, ServiceNow Hack4Good is a hackathon where developers, partners, and customers create real-world solutions for nonprofit organizations. After two successful years at the Knowledge conference, Hack4Good is spreading its wings into more year-round events, and our Hacktoberfest is one of its first stops!

This project is a new **Hack4Good Ideation Portal**. The records you contribute will be ideas and app suggestions that will fuel future Hack4Good initiatives. You'll learn how to contribute records to a ServiceNow repo, and your contributions will directly support future social impact projects.

Want to see what ideas have been submitted? Install this repository into a ServiceNow instance, then visit `https://YOUR-INSTANCE.service-now.com/h4g?id=h4g_submitted_ideas` (replace `YOUR-INSTANCE` with your ServiceNow instance subdomain) to view all submitted ideas.

> [!IMPORTANT]
> 🔔🔔🔔<br>
> **_CONTRIBUTORS must follow all guidelines in [CONTRIBUTING.md](CONTRIBUTING.md)_** or run the risk of having your Pull Requests labeled non-compliant or as spam.<br>
> 🔔🔔🔔


## We invite you to contribute!

To contribute, just follow these steps:

1. Fork this repo (you get a point just by forking!)
2. Go to your ServiceNow instance
3. Go to a Source Control-enabled Studio:
    - On Zurich and above: `ServiceNow Studio`
    - On Yokohama and earlier: `App Engine Studio` or `Legacy Studio`
4. Using your fork of this application, import it from source control, using the `main` branch:
    **Note:** If this is your first time using source control in this instance, create a credential as described by Earl [here](https://www.servicenow.com/community/developer-advocate-blog/source-control-in-servicenow-studio-complete-walkthrough/ba-p/3356303#create-a-credential-in-servicenow).
    - [SNS Import Instructions](http://servicenow.com/docs/bundle/zurich-application-development/page/build/servicenow-studio/task/sns-sc-import-app-source-control.html)
    - [AES Import Instructions](http://servicenow.com/docs/bundle/yokohama-application-development/page/build/app-engine-studio/task/source-control-import.html)
    - [Legacy Studio Import Instructions](https://www.servicenow.com/docs/bundle/yokohama-application-development/page/build/applications/task/t_ImportAppFromSourceControl.html)
5. Using a Source Control-enabled Studio, create a new branch and switch to it:
    - [SNS Create Branch Instructions](https://www.servicenow.com/docs/bundle/zurich-application-development/page/build/servicenow-studio/concept/sns-sc-create-versions-branches-git.html#title_sns-sc-create-repo-branch)
    - [AES Create Branch Instructions](https://www.servicenow.com/docs/bundle/yokohama-application-development/page/build/app-engine-studio/concept/create-versions-branches-git.html#title_source-control-create-branch)
    - [Legacy Studio Create Branch Instructions](https://www.servicenow.com/docs/bundle/yokohama-application-development/page/build/applications/task/t_CreateBranch.html)
6. Open your preferred studio experience
7. Submit a proposal: Go to `https://YOUR-INSTANCE.service-now.com/h4g?id=idea_submission&sys_id=12da163393c832108543b2597bba107d` (replace `YOUR-INSTANCE` with your ServiceNow instance subdomain) and fill out the form and Submit. The confirmation screen will also have follow-up instructions.
8. Using a Source Control-enabled Studio, commit your changes to source control:
    - [SNS Commit Changes Instructions](https://www.servicenow.com/docs/bundle/zurich-application-development/page/build/servicenow-studio/task/sns-sc-commit-changes-to-repository.html)
    - [AES Commit Changes Instructions](https://www.servicenow.com/docs/bundle/yokohama-application-development/page/build/app-engine-studio/task/source-control-commit-changes.html)
    - [Legacy Studio Commit Changes Instructions](https://www.servicenow.com/docs/bundle/yokohama-application-development/page/build/applications/task/t_CommitChanges.html)
9. Submit a pull request to the ServiceNowDevProgram/ActionPack `main` branch


That's it! More detailed contribution instructions can be found [here](CONTRIBUTING.md).
