# git

everyone's favourite VCS

## what's going on between these two branches

relevant: `man gitrevisions`

### print commits in develop but not in main

```
git log origin/main..origin/develop
```

## git reset --hard a directory

[source](https://stackoverflow.com/a/15404733)

```
git restore --source=HEAD --staged --worktree -- aDirectory
# or, shorter
git restore -s@ -SW  -- aDirectory
```

