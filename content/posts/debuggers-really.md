+++
date = "2023-04-02"
draft = true
path = "/blog/debuggers-really"
tags = ["debugging"]
title = "Our debuggers are awful"
+++

* Working on otel for rust
* Have to vendor several things to get http request logs
* Why are browsers the only things that you can dump http request logs from
* Why can't I dump a http/2 protocol trace from h2 in rust?

* This isn't a tracing problem
    * Tracing is designed to not leak customer data
    * Tracing is generally a metadata thing, *not* a data thing
    * Tracing needs instrumentation and seeing the possibility of a problem
      ahead of time
* What is a futuristic debugger, anyway?
    * Integrate with rr
    * Attach to a running system
    * Has no overhead while not in use
    * Can get information out of a system which has not yet been instrumented
* So thats just dtrace
    * Yes kinda! But there's not enough instrumentation
    * I can't dump the request logs into browser devtools (e.g. with a .har
      file)
    * Rust ecosystem does not really have deep dtrace integration
* Debugging a system is too important to disturb it
    * Debugging a system is too important to care about module privacy
* Sidebar: "realness"
    * When we build systems, we tend to treat the user . . . patronizingly, or
      at least specially
    * Database schemas with cursed tag-value schemas rather than dynamic
      schemas
    * Lowering things into a worse value representation that's different than
      host-language objects
    * Cannot introspect objects while ignoring module privacy, even though you
      could exactly do this given ctf data
    * RUSTC_BOOTSTRAP
