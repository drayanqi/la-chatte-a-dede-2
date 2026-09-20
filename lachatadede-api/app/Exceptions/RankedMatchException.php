<?php

namespace App\Exceptions;

use Exception;

/**
 * A ranked matchmaking request could not be served: empty pool, ineligible
 * tactic, or a failed simulation. The status field maps the exception to
 * its HTTP response in the controller.
 */
class RankedMatchException extends Exception
{
    public function __construct(string $message, public readonly int $status)
    {
        parent::__construct($message);
    }
}
