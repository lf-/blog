{-# LANGUAGE DataKinds #-}
module WhatIThoughtDataKindsDid where

data Ty
    = A {field1 :: Int}
    | B {field2 :: Int}

someFunctionTakingB :: 'B -> Int
someFunctionTakingB = field2

{-
WhatIThoughtDataKindsDid.hs:8:24: error:
    • Expecting one more argument to ‘'B’
      Expected a type, but ‘'B’ has kind ‘Int -> Ty’
    • In the type signature: someFunctionTakingB :: 'B -> Int
  |
8 | someFunctionTakingB :: 'B -> Int
  |                        ^^
 -}
