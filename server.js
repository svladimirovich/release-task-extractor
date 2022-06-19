const { openRepository } = require('./git-tools');
const { excludeCommitsDownToSpecificSha } = require('./commit-inclusion-analyzer');
const commandLineArgs = require('command-line-args');

const commandLineDefinitions = [
    {
        name: 'repository',
        alias: 'r',
        type: String,
    },
    {
        name: 'branch',
        alias: 'b',
        type: String,
    },
    {
        name: 'previous-version-branch',
        alias: 'e',
        type: String,
    },
    {
        name: 'final-sha',
        alias: 'c',
        type: String,
    },
    {
        name: 'final-tag',
        alias: 't',
        type: String,
    },
    {
        name: 'jira-user',
        alias: 'u',
        type: String,
    },
    {
        name: 'jira-password',
        alias: 'p',
        type: String
    },
    {
        name: 'jira-host',
        alias: 'h',
        type: String
    }
    // { name: 'target', alias: 'v', type: Boolean },
    // { name: 'src', type: String, multiple: true, defaultOption: true },
    // { name: 'timeout', alias: 't', type: Number }
];

const options = commandLineArgs(commandLineDefinitions);
let errorNumber = 0;
console.log("running task extractor with options", options);

if (!options["repository"]) {
    console.log("must specify --repository in order to run this");
    errorNumber = errorNumber | 1;
}

if (!options["branch"]) {
    console.log("must specify --branch in order to run this");
    errorNumber = errorNumber | 2;
}

if (!(options["previous-version-branch"] || options["final-sha"] || options["final-tag"])) {
    console.log("must specify --previous-version-branch or --final-sha or --final-tag in order to run this");
    errorNumber = errorNumber | 4;
}

if (!(options["jira-host"] && options["jira-user"] && options["jira-password"])) {
    console.log("make sure you specified jira credentials: --jira-host, --jira-user and --jira-password");
    errorNumber = errorNumber | 8;
}

if (errorNumber > 0) {
    process.exit(errorNumber);
}

void async function() {
    const git = await openRepository(options["repository"]);

    let targetSha = options["final-sha"];

    const commits = await git.extractCommits(options["branch"]);
    let filteredCommits = null;

    if (options["previous-version-branch"]) {
        // make a dictionary out of previous version commits
        const previousVersionCommitsShaDictionary = (await git.extractCommits(options["previous-version-branch"])).reduce((acc, next) => {
            acc[next.sha] = true;
            return acc;
        }, {});
        // exclude previous version commits from the full set of current version commits
        filteredCommits = commits.filter(commit => !previousVersionCommitsShaDictionary[commit.sha]);
    } else {
        // exclude commits down until specific sha (or tag)
        if (!targetSha) {
            targetSha = await git.getShaByTag(options["final-tag"]);
        }
        filteredCommits = excludeCommitsDownToSpecificSha(commits, targetSha);
    }

    console.log("Filtered Commits:", filteredCommits.map(c => ({
        sha: c.sha, message: c.message
    })));

    const jira = await require('./jira-tools.js').create({
        host: options["jira-host"],
        user: options["jira-user"],
        password: options["jira-password"],
    });

    const tasks = jira.extractTasksFromCommits(filteredCommits);
    for (const [taskId, task] of Object.entries(tasks)) {
        console.log(`Requesting task info ${taskId} from JIRA`);
        const jiraInfo = await jira.getTaskInfoFromJira(taskId).catch(error => {
            console.log(`Error while retrieving info for task ${taskId} from JIRA: ${String(error).substring(0, 30)}`);
            return {};
        });
        Object.assign(task, jiraInfo);
    }

    console.log("total commits", commits.length, "filtered commits", filteredCommits.length);
}();
