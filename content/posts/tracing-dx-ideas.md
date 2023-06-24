+++
date = "2022-12-26"
draft = true
path = "/blog/tracing-dx-ideas"
tags = ["haskell", "opentelemetry", "developer-experience"]
title = "Make tracing easy easily! Developer experience ideas"
+++

I interned at Mercury for several months and built out a lot of developer
experience improvements. Many of these were driven by having a good sense of
whether something will be feasible in an afternoon and knowing that I can get
away with spending an afternoon programming something nobody asked for yet.

# OpenTelemetry/Tracing

Many of the highest impact ideas I had were related to OpenTelemetry tracing:
my goal was to make tracing the first choice to investigate any kind of problem
from development to production. This blog post catalogues the ideas that I
implemented, how much work they were, and whether I think they're worth it.

## Put a link to traces in a header

I made the back-end emit a header `trace-link`, which contains a link to the
Honeycomb trace for the request.

#### How easy was it?

1 afternoon of work (plus a couple days work later once we had to start hitting
the API due to the new data model with environments). Most of this work is open
source and reusable for Haskell apps.

#### What did it accomplish?

This was probably the best tracing adoption improvement I made because it lets
devs directly look at misbehaving requests in browser dev tools and then open
the trace in one click. It singlehandedly got a handful of people to start
using tracing.

It doesn't really give any capability that isn't available by copying the trace
ID out of the second component of the `traceparent` header you're already
sending if you're using the [w3c trace propagator], however, doing that is very
arduous and manual.

If you have trace ID generation code, you can also start emitting trace IDs in
other places, such as logs, exception reporting systems, and anywhere else you
might want to follow requests through.

#### How to do it

If you're using the hs-opentelemetry ecosystem for Haskell, the relevant code
is here, in the package `hs-opentelemetry-vendor-honeycomb`:

https://github.com/iand675/hs-opentelemetry/tree/main/vendors/honeycomb

What this package does is:

1. Find where data is going using the [Honeycomb Auth API]: you need to know
   the dataset, tenancy name, and environment that the API key is going into.

   In my design, this data is acquired at startup time so trace link generation
   is just string concatenation thereafter.

2. Create [Direct Trace Links] using the trace ID then put them in a header.


[Honeycomb Auth API]: https://docs.honeycomb.io/api/auth/
[Direct Trace Links]: https://docs.honeycomb.io/api/direct-trace-links/
[w3c trace propagator]: https://www.w3.org/TR/trace-context/

## Instrument the test suite

#### How easy was it?

Implementing the hspec stuff originally took about half a week since it involved reading
substantial amounts of hspec internals and poking around in a debugger. I
assume probably similar times for initially adding instrumentation to any other
test framework/language, with some adjustment for how well documented they are
(deduct some points from hspec for confusing documentation).

However, once the integration to your test framework of choice exists, it takes
a few minutes to add it to a new codebase.

#### What did it accomplish?

I was initially surprised at this having as big an impact as it did, but
Honeycomb wound up being the easiest and cleanest way to view test suite runs
and get database logs, exceptions and other useful debugging info to fix broken
tests. This was a very worthwhile project and saved a handful of people
probably a couple of hours each debugging thorny test failures.

#### How to do it

I wrote a Haskell library that starts spans for each test case in hspec:
[hs-opentelemetry-instrumentation-hspec]. Plug this in per the example in the
sources, and then you're done.

Bonus points if you print out a trace link at the end, since you can just reuse
the trace link infrastructure from above for this.

You may also need to modify the way you do database interactions in tests to
use instrumentation, for example.

[hs-opentelemetry-instrumentation-hspec]: https://github.com/iand675/hs-opentelemetry/tree/main/instrumentation/hspec

## Instrument scheduled tasks

#### How easy was it?

20 minutes to initialize tracing that already existed for the app, but in the
scheduled tasks system.

#### What did it accomplish?

This one achieved ridiculously good results basically immediately: it's
significantly easier to debug scheduled task misbehaviour and performance.

#### How to do it

Initialize tracing in your scheduled task runner, then create a context/root
span for the task execution. Bonus points if you propagate the trace ID context
from whatever invoked the scheduled task so you can correlate it with the
initiating request in your tracing system.

# Database

While I was working at Mercury we were using Postgres, but these ideas are
fairly generic.

## Speedy test startup

I debugged an issue after introducing instrumentation to the test-suite, in
which migrations would run for 15 seconds or so on every test startup. This is
because the migration system was running hundreds of migrations on startup. I
solved this by restoring a snapshot of a pre-migrated database with
`pg_restore`, saving about 10 seconds and not changing anything semantically
(by comparison, a persistent test database has more risk of divergence).

The fastest way that I know of for creating a new Postgres database in a
desired state is to use the template feature of `createdb` with the `-T`
option, or `CREATE DATABASE yourname TEMPLATE yourtemplate`. This is a
filesystem-level copy which makes it extremely fast (less than a second on a
highly complex schema; compare to approximately 5 seconds to load the SQL for
that in).

This can be used to create a database for each concurrent test. Those test
databases can in turn be wiped after each test case with some kind of function
that uses `TRUNCATE` (again, very low level; doesn't look at the data) to wipe
the tables in preparation for the next case.

This leads to:

## Make testing migrations easy: ban down migrations

I wrote a script for testing database migrations. The idea that I had was born
out of frustration in dealing with wiped development databases while working on
migrations (which, to be clear, were easy to create, but still take 30 seconds
or something): what if you just snapshot the development database then
repeatedly run a migration?


