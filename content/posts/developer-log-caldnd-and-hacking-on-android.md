+++
author = "lf"
date = 2019-09-28T04:31:43Z
description = ""
draft = true
path = "/blog/developer-log-caldnd-and-hacking-on-android"
title = "Developer Log: CalDND and Hacking on Android"

+++

I have been developing a program called CalDND, which allows for better management of calendar-based automatic Do Not Disturb rules (internally called Zen rules). This post details stuff I learned along the way:

1. How GitHub code search works when you need to find stuff in obscure corners of the Android framework.
2. GitHub code search isn't ideal, so how to get yourself a copy of the Android source.
3. More about how the API actually works.

## GitHub Code Search

When trying to find uses of Android APIs but avoid their definitions, it's a pain: GitHub will give you 1000 copies of the Android sources of different ages, most of which are from custom ROMs. The most effective way I've tried to do this is by excluding the file names of the usages in the Android framework, for example, `META_DATA_CONFIGURATION_ACTIVITY -filename:ConditionProviderService.java`.

## Getting the sources effectively

I felt like it was more comfortable to work with a copy of the sources that I can do anything I want with, so the next task was to [download the Android sources](https://source.android.com/setup/build/downloading), so `repo init` then aggressively trim stuff that I don't think will have any answers using vim: `g/external/d`. Finally do a full `repo sync`. This won't work you're on very slow internet, as the sync will not finish in any timely manner (I left it overnight and it wasn't done by morning). It is advised to temporarily rent a fast virtual machine from Linode or another provider and play with the sources on there. I had the answers about the areas of the sources I was interested in within 2 hours, including the rental of the machine. I then just did a `repo sync frameworks/base` and `repo sync packages/apps/Settings` on my PC, which I can `ag` with reasonable performance.

## About the API

Note: this is referring to the deprecated API level 24 system. Why? My phone gets the API 29 update halfway through _next year_, and I want to write my app now. I believe a fair amount of it is still true on the new system.

I believe that the API works as follows: you get the permissions to work with the notifications/Do-Not-Disturb system, which allows you to bind a service and also lists your provider in the "Add Automatic Rule" list. [Docs](https://developer.android.com/reference/android/service/notification/ConditionProviderService.html).

If you specify a configuration activity, when your item is selected, it will pop up that activity, but will not give it any extras in the intent. What you're then expected to do is create an `AutomaticZenRule`, then put it through `[NotificationManager.addAutomaticZenRule()](https://developer.android.com/reference/android/app/NotificationManager.html#addAutomaticZenRule(android.app.AutomaticZenRule)`, store whatever details you need to, and `.finish()` your activity.

Future attempts to click on the automatic rule in the settings page will result in your activity being started with an extra on it, `[EXTRA_RULE_ID](https://developer.android.com/reference/android/service/notification/ConditionProviderService.html#EXTRA_RULE_ID)`, which you can then use to retrieve the settings for that rule from your storage.

### The weird parts about the API

There is one really confusing thing about this API, besides the fact that nobody uses it, which is that the schedule is stored as a **URI**. What?! To further confuse, the format of the URI in question is not thoroughly documented in the official documentation, which is a large part of why I had to read Android sources to begin with (as turns out, it's essentially totally free-form, but it took some significant source-reading to understand that).

Examples of how the system rules parse/use these URIs are in `frameworks/base/core/java/android/service/notification/ZenModeConfig.java`. The class that you're supposed to use to make these is the [Condition](https://developer.android.com/reference/android/service/notification/Condition.html). They are formatted like so: `condition://AUTHORITY/WHATEVER_YOU_WANT`, where the authority is your package name, and the path component is whatever you want to use to identify this rule. It is convenient to encode the entire data of the rule inside the rule URI if possible since you can avoid needing to write code to handle persistent storage if you do so.

