<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when the game engine cannot produce a simulation result:
 * unreachable, timeout, HTTP error, or a success:false response.
 */
class GameEngineException extends RuntimeException
{
    //
}
