+++
date = "2020-08-31"
draft = false
path = "/blog/debugging-template-haskell"
tags = ["haskell"]
title = "Debugging Template Haskell"
+++

Template Haskell powers a lot of really neat functionality in Yesod and
friends, but sometimes it can be broken. I'm writing this post to collect all
the info learned about GHC and Cabal from an unpleasant debugging session in
one place.

I was tracking down a problem causing my [work project](https://github.com/Carnap/Carnap)
to not build on a newer GHC version
([spoiler: it was this `persistent` bug](https://github.com/yesodweb/persistent/issues/1047))
and hit a brick wall when this happened:

```
/home/lf/dev/Carnap/Carnap-Server/Model.hs:16:7: error:
    • Not in scope: type constructor or class ‘CoInstructorId’
    • In the untyped splice:
        $(persistFileWith lowerCaseSettings "config/models")
   |
16 |     $(persistFileWith lowerCaseSettings "config/models")
   |       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

The next step was to figure out what was generating these type constructors and
why it was stuffed. [The Internet](https://stackoverflow.com/questions/15851060/ghc-ddump-splices-option-template-haskell)
suggested that I should pass `-ddump-splices -ddump-to-file` to ghc. Cool! So I
did and it didn't make any visible files. Dammit.

Some more Googling led to the option `-dth-dec-file`, which I also applied to
no observable effect. At this point my emotions were best described as 🤡.

So I read the documentation and find that there are still no mentions of what
the file is called or where it goes. I compile the version that is known to
work with the `-dth-dec-file`, since allegedly that one produces
`Filename.th.hs` files, and this time try a little harder to find them, using
`find -name '*.th.hs*'`. As it turns out, those files end up in the
`dist-newstyle` directory if running in Cabal. Specifically here:

> `dist-newstyle/build/x86_64-linux/ghc-x.y.z/YourPackage-a.b.c/build/Filename.th.hs`
> `dist-newstyle/build/x86_64-linux/ghc-x.y.z/YourPackage-a.b.c/build/Filename.dump-splices`

Once I found the files, I could track them down on the broken version, except
there was a problem: `-dth-dec-file` appears to run at one of the last compile
phases, which the broken file was not passing. If you are debugging compile
problems in a file that doesn't itself compile, you should use
`-ddump-splices -ddump-to-file`.

---

In summary:

* Use `-dth-dec-file` for a slightly shorter (11k lines vs 12k lines for
  Carnap's models), and possibly more readable TH output, if the file
  containing the splice builds.
* Use `-ddump-splices -ddump-to-file` if the file containing the splice doesn't
  build.
* Outputs will be in `dist-newstyle/build/x86_64-linux/ghc-x.y.z/YourPackage-a.b.c/Filename.{th.hs,dump-splices}`
* GHC documentation on dump options is [here](https://downloads.haskell.org/~ghc/latest/docs/html/users_guide/debugging.html#dumping-output)

