{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TypeFamilies #-}

module AssociatedTypes where

import Data.Kind (Type)
import Data.Proxy (Proxy (..))

-- * Concatenating a type-level list

data TCell (t :: Type) = TNil | TCons t (TCell t)

-- | meow~
class Cat (a :: TCell Type) (b :: TCell Type) where
    -- Result type. Since cats result in kittens, of course.
    type Kitten a b :: TCell Type

instance Cat 'TNil b where
    type Kitten 'TNil b = b

instance Cat ('TCons v a) b where
    type Kitten ('TCons v a) b = 'TCons v (Kitten a b)

data T1
data T2
data T3
data T4

type OneTwo = TCons T1 (TCons T2 TNil)
type ThreeFour = TCons T3 (TCons T4 TNil)

{-
-- It's also way easier to test:

>>> :kind! Kitten OneTwo ThreeFour
Kitten OneTwo ThreeFour :: TCell (*)
= 'TCons T1 ('TCons T2 ('TCons T3 ('TCons T4 'TNil)))
-}
