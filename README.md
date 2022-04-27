

sample start command:
```
$ node server.js --repository /myproject --final-tag v2.1 --jira-host jira.mycompany.com --jira-user mike --jira-password mypass
```

Full command sample using docker container
```
$ docker run -it --rm -v $(pwd):/myproject task-extractor -- -r /myproject -t v2.1 -h jira.mycompany.com -u mike -p mypass
```

