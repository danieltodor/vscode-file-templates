For new projects, instead of creating the same files and directories over and over again,
like `README.md`, `.gitignore` or the `src` directory, create reusable template files and directories,
some with pre filled content.

When used, this extension will copy paste the content of a template into the workspace root.\
Or if used from the explorer context menu, any directory can be a target.

### Commands
| Name | Description |
| - | - |
| File/Directory Templates: Create | Create a new template with a specific name, then place the desired files into it |
| File/Directory Templates: Open | Open the directory of a template |
| File/Directory Templates: Rename | Rename a template |
| File/Directory Templates: Remove | Remove a template |
| File/Directory Templates: Use Template | Use a template |
| File/Directory Templates: Use Templates | Use one or multiple templates |

### Settings
| Name | Type | Default | Description |
| - | - | - | - |
| file-templates-n.dereferenceSymlinks | boolean | true | In case of a symlink, copy the file itself, instead of a symlink |
| file-templates-n.force | boolean | false | Overwrite existing files on conflict |
