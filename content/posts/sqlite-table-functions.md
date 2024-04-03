+++
date = "2023-12-04"
draft = false
path = "/blog/sqlite-table-functions"
tags = ["sqlite"]
title = "Table-valued functions and the missing JOIN LATERAL in sqlite"
+++

With the [sqlite-regex] extension you can get Rust's [regex][rust-regex] inside
sqlite. Among the relatively normal APIs it has, it also provides a function
that's quite hard to use, as it is a rare ["table-valued function"][tvf].

[tvf]: https://www.sqlite.org/vtab.html#tabfunc2
[sqlite-regex]: https://github.com/asg017/sqlite-regex
[rust-regex]: https://crates.io/crates/regex

```sql
select coalesce(cast(regex_capture(captures, 'mins') as numeric), 0) * 60000 + coalesce(cast(regex_capture(captures, 'secs') as numeric), 0) * 1000 + coalesce(cast(regex_capture(captures, 'ms') as numeric), 0) as millis
    from regex_captures
    where pattern = regex('((?P<mins>\d+) ?min)? ?((?P<secs>\d+) ?s)? ?((?P<ms>\d+) ?ms)?')
    and contents = '02 s 07ms';
```

