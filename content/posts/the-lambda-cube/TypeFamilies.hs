{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TypeFamilies #-}

module TypeFamilies where

import Data.Kind (Type)
import Data.Proxy (Proxy (..))

-- * Concatenating a type-level list

data TCell (t :: Type) = TNil | TCons t (TCell t)

-- | meow~
--
--   Wow, it's two lines and they look vaguely like value level code
type family Cat (a :: TCell Type) (b :: TCell Type) :: TCell Type where
    Cat 'TNil b = b
    Cat ('TCons v a) b = 'TCons v (Cat a b)

data T1
data T2
data T3
data T4

type OneTwo = TCons T1 (TCons T2 TNil)
type ThreeFour = TCons T3 (TCons T4 TNil)

{-
>>> :kind! Cat OneTwo ThreeFour
Cat OneTwo ThreeFour :: TCell (*)
= 'TCons T1 ('TCons T2 ('TCons T3 ('TCons T4 'TNil)))
-}
