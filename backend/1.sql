const updateResult = await client.query(
    `UPDATE sales_order_headers
     SET
        status = 'REJECTED',
        remarks = CONCAT(
            COALESCE(remarks, ''),
            CASE
                WHEN COALESCE(remarks, '') = '' THEN ''
                ELSE E'\\n'
            END,
            'Rejection reason: ',
            $2
        )
     WHERE order_id = $1
     RETURNING order_id, order_number, status, remarks`,
    [orderId, reason.trim()]
);