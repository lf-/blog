{-# LANGUAGE GADTs #-}
module Peano where

-- uninhabited types
data Zero
data Succ n

data Peano a where
    S :: Peano a -> Peano (Succ a)
    Z :: Peano Zero

-- This will not type check with a zero; also, the compiler is clever enough to
-- know that you don't need to match the Z case here!
predecessor :: Peano (Succ a) -> Peano a
predecessor (S n) = n

{-
Peano.hs:16:23: error:
    • Couldn't match type ‘Zero’ with ‘Succ a’
      Expected: Peano (Succ a)
        Actual: Peano Zero
   |
16 | kablammo = predecessor Z
   |                        ^
-}
-- kablammo = predecessor Z
