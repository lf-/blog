{-# LANGUAGE DataKinds #-}
{-# LANGUAGE FlexibleContexts #-}
{-# LANGUAGE FunctionalDependencies #-}
{-# LANGUAGE MonoLocalBinds #-}
{-# LANGUAGE MultiParamTypeClasses #-}
{-# LANGUAGE UndecidableInstances #-}

module MPTCFundeps where

import Data.Kind (Type)
import Data.Proxy (Proxy (..))

-- * Concatenating a type-level list

data TCell (t :: Type) = TNil | TCons t (TCell t)

-- | meow~
class Cat (a :: TCell Type) (b :: TCell Type) (result :: TCell Type) | a b -> result

instance Cat 'TNil b b
instance Cat a 'TNil a

-- This is kind of Weird. You have to write the recursive case by
-- destructuring the arguments on the right-hand side, then provide evidence on
-- the left hand side, then construct the result on the right. Needless to say,
-- it's mind-bending in a bad way.
--
-- Fundeps-based type level programming is unnecessarily hard!
instance (Cat a b r) => Cat ('TCons v a) b ('TCons v r)

data T1
data T2
data T3
data T4

type OneTwo = TCons T1 (TCons T2 TNil)
type ThreeFour = TCons T3 (TCons T4 TNil)

{-
>>> v = Proxy :: Cat OneTwo ThreeFour r => Proxy r
>>> :t v
v :: Proxy ('TCons T1 ('TCons T2 ('TCons T3 ('TCons T4 'TNil))))
-}
