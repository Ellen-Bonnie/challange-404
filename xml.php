<?php
$xml = <<<XML
<Data>
<Sample Value="5.64472e-011"/>
<Sample Value="8.91325e-007"/>
</Data>
XML;

$data = simplexml_load_string($xml);
foreach($data as $key => $node) {
    echo $node->attributes()->Value . "\n"; // here Value is an attribute name.. you can get any attribute like this.
}
