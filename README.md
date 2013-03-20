## Install
```sh
  $ git clone https://github.com/douglasmiller/node-jira-template.git
  $ cd node-jira-template
  $ npm install
  $ cp config.example.js config.js
  $ node start
```

## Usage
Templates are found by looking for any project with a key starting with TMPL.

After selecting a template and a destination project, this application will copy all issues and any internal issue links to the destination project.
