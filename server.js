const express = require('express')
const mysql = require('mysql')
const bcryptjs = require('bcryptjs')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const bcrypt = require("bcrypt")
const { query } = require('express')
require('dotenv').config()
const db = mysql.createConnection({
    host: process.env.HOSTNAME,
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PWD,
    database: process.env.DATABASE_NAME
})
const PORT = process.env.PORT || 5000
const app = express()
app.use(cors())
app.use(express.json())
db.connect((err) => {
    if(err) {
        throw err
    }
    console.log('DB Connected.')
})

const auth = async (req,res,next) => {
    try {
        const employeeNumber = req.body.employeeNumber
        const token = req.body.token
        let auth = true
        
        let sql = `SELECT employeeNumber FROM employeeusers WHERE token='${token}'`
        db.query(sql, (err, result) =>{
            if(err) throw err
            if(employeeNumber == result)
                 auth = true
        })         
        
        if(auth) next()
        else throw new Error()
    } catch (error) {
        res.status(400).json({ error: 'Not autheorized to access this resource'})
    }
}

app.post('/employee/orders', auth, (req, res) =>{
    let sql = `SELECT * FROM orders WHERE status='On Hold' or status='Resolved'`
    db.query(sql, (err, results) =>{
        if(err) console.log(err)
        console.log('get order list')
        res.send({orders:results})
    })
})

app.post('/employee/orderdetails', auth, (req, res) =>{
    let sql = `SELECT products.productCode, products.productName, products.quantityInStock, orderdetails.quantityOrdered 
    FROM orderdetails join products on orderdetails.productCode = products.productCode WHERE orderNumber=${req.body.orderNumber}`
    db.query(sql, (err, results) =>{
        if(err) console.log(err)
        let details = ''
        let placed = 'can place'
        results.map(product =>{
            details +=` ${product.productCode}(${product.quantityOrdered} items `
            if(product.quantityInStock >= product.quantityOrdered) details += ` filled)\n`
            else {
                const missing = product.quantityOrdered - product.quantityInStock
                details += ` missing ${missing} items)\n`
                placed = 'cannot place'
            }
        })
        // console.log('details of order number ' + req.body.orderNumber)
        res.send({details:details, placed:placed})
    })
})

app.post('/employee/placeorder', auth, (req,res) =>{
    let sql = `SELECT products.productCode, products.productName, products.quantityInStock, orderdetails.quantityOrdered 
    FROM orderdetails join products on orderdetails.productCode = products.productCode WHERE orderNumber=${req.body.orderNumber}`
    db.query(sql, (err, results) =>{
        if(err) console.log(err)
        let placed = 'placed'
        db.query('BEGIN',(err)=>{ if(err) console.log(err)})
        results.map(product =>{
            if(placed !== 'error' && product.quantityInStock - product.quantityOrdered >= 0){
                const amount = product.quantityInStock - product.quantityOrdered
                let updateSql = `UPDATE products SET quantityInStock=${amount} WHERE productCode='${product.productCode}'`
                db.query(updateSql, (err)=>{
                    if(err) {
                        console.log(err)
                        placed = 'error'
                        res.status(400).json({status: '.:error:.\nPlease try again.'})
                    }else{
                        sql = `UPDATE orders SET status='Shipped' WHERE orderNumber=${req.body.orderNumber}`
                        db.query(sql, (err) =>{
                            if(err){
                                console.log(err)
                                placed = 'error'
                            }
                        })
                    }
                })
            }else placed = 'error'
        })
        db.query('COMMIT')
        if(placed === 'error') res.status(400).json({error: 'error'})
        console.log('order number ' + req.body.orderNumber + ' ' + placed)
        res.send({placed:placed})
    })
})

app.post('/employee/products', auth, (req, res) =>{
    let sql = `SELECT * FROM products`
    db.query(sql, (err, results) =>{
        if(err) {
            console.log(err)
            res.status(400).json({status: '.:error:.'})
        }
        else {
            console.log('get products list')
            res.send({products: results})
        }
    })
})

app.post('/employee/delproduct', auth, (req,res) =>{
    let sql = `DELETE FROM products WHERE productCode='${req.body.productCode}'`
    db.query(sql, (err)=>{
        if(err) {
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }
        else {
            console.log('Product ' + req.body.productCode + ' deleted.')
            res.send({status: '.:Delete successful:.'})
        }

    })
    
})

app.post('/employee/addproduct', auth, async (req, res) =>{
    let productCode = `S${req.body.productScale.split(':')[1]}_${(Math.floor(Math.random() * 8999)+1000)}`
    let d = new Date()
    let year = d.getFullYear()
    let sql =  `INSERT INTO products(productCode, productName, productLine, productScale, productVendor, productDescription, quantityInStock, buyPrice, MSRP)
                VALUES('${productCode}','${year + ' ' + req.body.productName}', '${req.body.productLine}', '${req.body.productScale}', '${req.body.productVendor}', 
                '${req.body.productDescription}', ${req.body.quantityInStock}, ${req.body.buyPrice}, ${req.body.MSRP})`

    db.query(sql, (err) =>{
        if(err) {
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            console.log('Product ' + productCode +' added.')
            res.send({status: '.:Add product successful:.',productCode:productCode,productName:(year + ' ' + req.body.productName)})
        }
        
    })
})

app.post('/employee/disputedorder', auth, (req,res) =>{
    let sql = `SELECT * FROM orders WHERE status = 'Disputed'`
    db.query(sql, (err, results) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }
        else{
            console.log('get disputed order')
            res.send({orders: results})
        }
    })
})

app.post('/employee/resolvedorder', auth, (req, res) => {
    let sql = `UPDATE orders SET status='Resolved' WHERE orderNumber=${req.body.orderNumber}`
    db.query(sql, (err) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            console.log('Order ' + req.body.orderNumber + ' resolved.')
            res.send({status:'Resolved'})
        }
    })
})

app.post('/employee/payments', auth, (req,res) =>{
    let sql = `SELECT payments.customerNumber, payments.checkNumber, payments.amount, paymentorders.paid, sum(od.amountInOrder) amountInOrder FROM payments JOIN paymentorders ON payments.checkNumber = paymentorders.checkNumber 
    JOIN (SELECT orderNumber, sum(quantityOrdered * priceEach) amountInOrder FROM orderdetails GROUP BY orderNumber) od ON paymentorders.orderNumber = od.orderNumber GROUP BY payments.checkNumber `
    db.query(sql, (err,results) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            console.log('get payments')
            results = results.filter(result =>{ return result.paid === 'waiting'})
            res.send({payments:results})
        }
    })
})

app.post('/employee/editproduct', auth, (req, res) =>{
    let sql = `UPDATE products SET productName='${req.body.productName}', productLine='${req.body.productLine}', productScale='${req.body.productScale}', 
    productVendor='${req.body.productVendor}', productDescription='${req.body.productDescription}', quantityInStock=${req.body.quantityInStock}, 
    buyPrice=${req.body.buyPrice}, MSRP=${req.body.MSRP} WHERE productCode='${req.body.productCode}'`
    db.query(sql, (err) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            console.log(`Product ${req.body.productCode} updated.`)
            res.send({status:'.:Update successful:.'})
        }
    }) 
})

app.post('/employee/creatediscount', auth, (req, res) =>{
    console.log("what" + req.body.percentage)
    let sql = `INSERT INTO discounts(discountCode, startDate, endDate, quantity, minimumPrice, percentage)
        VALUES ('${req.body.discountCode}', '${req.body.startDate}', '${req.body.endDate}', ${req.body.quantity}, ${req.body.minimumPrice}, ${parseInt(req.body.percentage)})`
    db.query(sql, (err) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            console.log(`discountCode: '${req.body.discountCode}' added.`)
            res.send({status:'.:Discount code added:.'})
        }
    })
})

app.post('/employee/ermfeature', auth, (req, res) =>{
    let sql = `WITH RECURSIVE chain_of_command AS (
        SELECT employeeNumber, 1 n
        FROM employees
        WHERE reportsTo = '${req.body.employeeNumber}'
        
        UNION ALL
    
        SELECT em.employeeNumber, n + 1
        FROM employees em, chain_of_command coc
        WHERE em.reportsTo = coc.employeeNumber
    )
    SELECT * FROM chain_of_command join employees on chain_of_command.employeeNumber = employees.employeeNumber;`
    db.query(sql, (err, results) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            let ermLevel = 0
            console.log('get employees')
            for(let i=0;i<results.length;i++){
                if(results[i].jobTitle.endsWith('Rep')) results[i].n = 0;
                else if(results[i].jobTitle.search('Manager') !== -1) results[i].n = 1
                else if(results[i].jobTitle.startsWith('VP')) results[i].n = 2
                else results[i].n = 3
            }
            sql = `SELECT jobTitle FROM employees WHERE employeeNumber=${req.body.employeeNumber}`
            db.query(sql,(err, results2) =>{
                if(err){
                    console.log(err)
                    res.status(400).json({status: '.:error:.\nPlease try again.'})
                }else{
                    if(results2[0].jobTitle.endsWith('Rep')) ermLevel = 0
                    else if(results2[0].jobTitle.search('Manager') !== -1) ermLevel = 1
                    else if(results2[0].jobTitle.startsWith('VP')) ermLevel = 2
                    else ermLevel = 3
                    res.send({employees: results, ermLevel:ermLevel})
                }
            })
        }
    })
})

app.post('/employee/cusregister', auth, async (req, res) =>{
    let sql = `SELECT max(customerNumber) max FROM customers`
    let password = ''
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    
    for ( let i = 0; i < 6; i++ ) {
        password += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    let passwordHash = await bcryptjs.hash(password, 10)
    db.query(sql, (err, result) =>{
        if(err) console.log(err)
        result.map(r => result = r.max + 1)
        db.query('BEGIN')
        db.query('SET FOREIGN_KEY_CHECKS = 0')
        let sql1 = `INSERT INTO customers (customerNumber, customerName, contactLastName, contactFirstName, phone, addressLine1, addressLine2, city, state
        , postalCode, country, salesRepEmployeeNumber, creditLimit) VALUES (${result}, '${req.body.customerName}', '${req.body.contactLastName}', '${req.body.contactFirstName}', '${req.body.phone}', '${req.body.addressLine1}', '${req.body.addressLine2}',
        '${req.body.city}', '${req.body.state}', '${req.body.postalCode}', '${req.body.country}', ${req.body.creditLimit}, '${req.body.employeeNumber}')`
        db.query(sql1, (err) =>{
            if(err) console.log(err)
        })
        db.query('SET FOREIGN_KEY_CHECKS = 0')
        let sql2 = `INSERT INTO customerusers(customerNumber, password) VALUES (${result}, '${passwordHash}')`
        db.query(sql2, (err) =>{
            if(err){
                console.log(err)
                db.query('ROLLBACK')
                res.status(400).send({status: '.:error:.\nPlease try again.'})
            }else{
                console.log(password)
                console.log('Customer number '+ result +' registered.')
                res.send({status: 'CustomerNumber : ' + result + '\nPassword : '+ password})
            }
        })
        db.query('COMMIT')
    })
})

app.post('/employee/login',async (req, res) => {
    let sql = `SELECT * FROM employeeusers WHERE employeeNumber='${req.body.employeeNumber}'`
    const payload = { employeeNumber:req.body.employeeNumber }
    const token = jwt.sign(payload, process.env.TOKEN_KEY)
    db.query(sql,async (err, results) =>{
        if(err) console.log(err)
        if(results[0]){
            const isPasswordMatch = await bcrypt.compare(req.body.password, results[0].password)
            if(isPasswordMatch){
                let sql2 = `UPDATE employeeusers SET token='${token}' WHERE employeeNumber=${req.body.employeeNumber}`
                db.query(sql2, (err) => {if(err) console.log(err)})
                let sql3 = `SELECT * FROM employees WHERE employeeNumber=${req.body.employeeNumber}`
                db.query(sql3, (err,result) =>{
                    if(err){
                        console.log(err)
                    }else{
                        result[0].token = token
                        console.log('employee number ' + req.body.employeeNumber + ' login.')
                        res.send({employee: result[0]})
                    }
                })
            }else res.status(400).json({status: '.:EmployeeNumber or password incorrect:.'})
        }
        else res.status(400).json({status: '.:EmployeeNumber or password incorrect:.'})
    })
})

app.post('/employee/logout', auth, (req, res) =>{
    let sql = `UPDATE employeeusers SET token=null WHERE employeeNumber=${req.body.employeeNumber}`
    db.query(sql, (err) =>{
        if(err) console.log(err)
        else{
            console.log('employee number ' + req.body.employeeNumber + ' logout.')
            res.send({status:'.:logout:.'})
        }
        
    })
})

app.post('/employee/promote',async (req, res) =>{
    if(req.body.nA < req.body.ermLevel - 1){
        let n = req.body.nA + 1
        let jobTitle = req.body.jobTitleA
        let sale = ['Sales Rep', 'Sales Manager', 'VP Sales', 'President']
        let marketing = ['Marketing Rep', 'Marketing Manager', 'VP Marketing', 'President']
        let sql = `SELECT territory FROM offices WHERE officeCode='${req.body.officeCodeA}'`
        if(jobTitle.startsWith('Sales') || jobTitle.endsWith('Sales')) jobTitle = sale[n]
        else jobTitle = marketing[n]
        db.query('BEGIN')
        await db.query(sql , (err, results) =>{
            if(err) console.log(err)
            if(n === 1) jobTitle += ` (${results[0].territory})`
            sql = `SELECT officeCode FROM employees WHERE jobTitle='${jobTitle}'`
            db.query(sql, (err, results) => {
                if(err) console.log(err)
                let sameOffice = false
                results.map(result =>{
                    if(result.officeCode === req.body.officeCodeA) sameOffice = true
                })
                if(results[0] && (jobTitle.startsWith('VP') || (jobTitle.search('Manager') !== -1 && sameOffice))){
                    if(jobTitle.search('Manager') !== -1) res.status(400).json({status:`'${jobTitle}' in office '${req.body.officeCodeA}' already exist.`})
                    else res.status(400).json({status:`'${jobTitle}' already exist.`})
                }else{
                    sql = `UPDATE employees SET jobTitle='${jobTitle}' WHERE employeeNumber=${req.body.employeeNumberA}`
                    db.query(sql, (err) =>{
                        if(err){
                            console.log(err)
                            res.status(400).json({status: '.:error:.\nPlease try again.'})
                        }else{
                            if(jobTitle.search('Manager') !== -1){
                                db.query('SET FOREIGN_KEY_CHECKS = 0')
                                sql = `UPDATE employees SET reportsTo=${req.body.employeeNumberA} WHERE jobTitle='${jobTitle.startsWith('Sales') !== -1 ? sale[0] : marketing[0]}' 
                                AND officeCode=${req.body.officeCodeA}`
                                db.query(sql, (err) =>{
                                    if(err){
                                        console.log(err)
                                        res.status(400).json({status: '.:error:.\nPlease try again.'})
                                    }
                                    else { 
                                        db.query('COMMIT')
                                        console.log('Employee Number ' + req.body.employeeNumberA + ' ' + req.body.promoteA)
                                        res.send({nA:n, jobTitleA:jobTitle})
                                    }
                                    
                                })
                            }else {
                                db.query('SET FOREIGN_KEY_CHECKS = 0')
                                sql = `UPDATE employees SET reportsTo=${req.body.employeeNumberA} WHERE jobtitle LIKE '${jobTitle.startsWith('Sales') !== -1 ? sale[1] : marketing[1]}%'`
                                db.query(sql, (err) =>{
                                    if(err) {
                                        console.log(err)
                                        res.status(400).json({status: '.:error:.\nPlease try again.'})
                                    }else{
                                        db.query('COMMIT')
                                        console.log('Employee Number ' + req.body.employeeNumberA + ' ' + req.body.promoteA)
                                        res.send({nA:n, jobTitleA:jobTitle})
                                    } 
                                })
                            }
                            
                        }
                    })
                }
            })
        })
    }
    else{
        console.log('error: Cannot promote')
        res.status(400).json({status: '.:error:.\nCannot promote.'})
    }
})

app.post('/employee/demote',async (req, res) =>{
    if(req.body.nA > 0){
        let n = req.body.nA - 1
        let jobTitle = req.body.jobTitleA
        let sale = ['Sales Rep', 'Sales Manager', 'VP Sales', 'President']
        let marketing = ['Marketing Rep', 'Marketing Manager', 'VP Marketing', 'President']
        let sql = `SELECT territory FROM offices WHERE officeCode='${req.body.officeCodeA}'`
        if(jobTitle.startsWith('Sales') || jobTitle.endsWith('Sales')) jobTitle = sale[n]
        else jobTitle = marketing[n]
        db.query('BEGIN')
        await db.query(sql , (err, results) =>{
            if(err) console.log(err)
            if(n === 1) jobTitle += ` (${results[0].territory})`
            sql = `SELECT officeCode FROM employees WHERE jobTitle='${jobTitle}'`
            db.query(sql, (err, results) => {
                if(err){
                     console.log(err)
                     db.query('ROLLBACK')
                }
                let sameOffice = false
                results.map(result =>{
                    if(result.officeCode === req.body.officeCodeA) sameOffice = true
                })
                if(results[0] && (jobTitle.search('Manager') !== -1 && sameOffice)){
                    if(jobTitle.search('Manager') !== -1) res.status(400).json({status:`'${jobTitle}' in office '${req.body.officeCodeA}' already exist.`})
                    else res.status(400).json({status:`'${jobTitle}' already exist.`})
                }else{
                    sql = `UPDATE employees SET jobTitle='${jobTitle}' WHERE employeeNumber=${req.body.employeeNumberA}`
                    db.query(sql, (err) =>{
                        if(err){
                            console.log(err)
                            res.status(400).json({status: '.:error:.\nPlease try again.'})
                        }else{
                            sql = `UPDATE employees SET reportsTo=${req.body.reportsToA} WHERE reportsTo=${req.body.employeeNumberA}`
                            db.query(sql ,(err) =>{
                                if(err){
                                    console.log(err)
                                    res.status(400).json({status: '.:error:.\nPlease try again.'})
                                }else{
                                    db.query('COMMIT')
                                    console.log('Employee Number ' + req.body.employeeNumberA + ' ' + req.body.promoteA)
                                    res.send({nA:n, jobTitleA:jobTitle})
                                }
                            })
                        }
                    })
                }
            })
        })
    }
    else{
        console.log('error:Cannot domote')
        res.status(400).json({status: '.:error:.\nCannot demote.'})
    }
})

app.post('/employee/receivedpayment', (req, res) =>{
    let sql = `UPDATE paymentorders SET paid='paid' WHERE checkNumber='${req.body.checkNumber}'`
    db.query(`BEGIN`)
    db.query(sql, (err) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            sql = `UPDATE orders SET status='On Hold' WHERE orderNumber IN (SELECT orderNumber FROM paymentorders WHERE checkNumber='${req.body.checkNumber}')`
            db.query(sql, (err, results)=>{
                if(err){
                    console.log(err)
                    res.status(400).json({status: '.:error:.\nPlease try again.'})
                }else{
                    db.query(`COMMIT`)
                    console.log(`check number ${req.body.checkNumber} received`)
                    res.send({status: `check number ${req.body.checkNumber} received`})
                }

            })
        }
    })
    
})

app.post('/employee/rejectedpayment', (req, res) =>{
    let sql = `DELETE FROM payments WHERE checkNumber='${req.body.checkNumber}'`
    db.query(sql, (err) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            console.log( `.:check number ${req.body.checkNumber} rejected:.`)
            res.send({status: `.:check number ${req.body.checkNumber} rejected:.`})
        }
    })
})


//------------------------------------------------------------Customers-----------------------------------------------------------------------------//
app.post('/customer/payment',(req,res) =>{
    let date = new Date()
    let sql = `INSERT INTO payments(customerNumber,checkNumber,paymentDate,amount) VALUES ('${req.body.customerNumber}','${req.body.checkNumber}','${date.toISOString().split('T')[0]}',${req.body.amount})`
    db.query(`BEGIN`)
    
    db.query(sql, (err) =>{
        if(err) console.log(err)
        else{
            req.body.orders.map(order =>{
                sql = `INSERT INTO paymentorders(checkNumber, orderNumber, paid) VALUES ('${req.body.checkNumber}', ${order.orderNumber}, 'waiting')`
                db.query('SET FOREIGN_KEY_CHECKS = 0')
                db.query(sql,(err)=>{
                    if(err) console.log(err)
                })
            })
            db.query(`COMMIT`)
            console.log('check number ' + req.body.checkNumber + ' insert.')
            res.send({status:'.:your payment is successful:.'})
        }
        
    })
})

app.post('/customer/login',async (req, res) => {
    
    let sql = `SELECT * FROM customerusers WHERE customerNumber='${req.body.customerNumber}'`
    const payload = { customerNumber:req.body.customerNumber }
    const token = jwt.sign(payload, process.env.TOKEN_KEY)
    db.query(sql,async (err, results) =>{
        if(err) console.log(err)
        if(results[0]){
            const isPasswordMatch = await bcrypt.compare(req.body.password, results[0].password)
            if(isPasswordMatch){
                let sql2 = `UPDATE customerusers SET token='${token}' WHERE customerNumber=${req.body.customerNumber}`
                db.query(sql2, (err) => {if(err) console.log(err)})
                let sql3 = `SELECT * FROM customers WHERE customerNumber=${req.body.customerNumber}`
                db.query(sql3, (err,result) =>{
                    if(err){
                        console.log(err)
                    }else{
                        result[0].token = token
                        console.log('customer number ' + req.body.customerNumber + ' login.')
                        res.send({customer: result[0]})
                    }
                })
            }else res.status(400).json({status: '.:CustomerNumber or password incorrect:.'})
        }
        else res.status(400).json({status: '.:CustomerNumber or password incorrect:.'})
    })
})

app.post('/customer/logout', auth, (req, res) =>{
    let sql = `UPDATE customerusers SET token=null WHERE customerNumber=${req.body.customerNumber}`
    db.query(sql, (err) =>{
        if(err) console.log(err)
        else{
            console.log('customer number ' + req.body.customerNumber + ' logout.')
            res.send({status:'.:logout:.'})
        }
        
    })
})

app.post('/customer/products', (req, res) =>{
    let sql = `SELECT * FROM products JOIN productlines ON products.productLine = productlines.productLine`
    db.query(sql, (err, results) =>{
        if(err) console.log(err)
        else{
            res.send({products: results})
        }
    })
})

app.post('/customer/addtocart', (req, res)=>{
    db.query('BEGIN')
    let sql =`SELECT * FROM cart WHERE customerNumber=${req.body.customerNumber} AND productCode='${req.body.product.productCode}'`
    db.query(sql, (err, results) =>{
        if(err){
            db.query('ROLLBACK')
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            if(results[0]){
                sql =`UPDATE cart SET quantityInCart=${results[0].quantityInCart + 1} WHERE customerNumber=${req.body.customerNumber} AND productCode='${req.body.product.productCode}'`
                db.query(sql, (err) =>{
                    if(err){
                        db.query('ROLLBACK')
                        console.log(err)
                        res.status(400).json({status: '.:error:.\nPlease try again.'})
                    }else{
                        console.log('customerNumber '+ req.body.customerNumber + ' add productCode ' + req.body.product.productCode +' to cart.')
                        res.send({status: `.:${req.body.product.productName} added:.`})
                    }
                })
            }else{
                if(req.body.product.quantityInStock > 0){
                    sql = `INSERT INTO cart(customerNumber, productCode, quantityIncart, preOrder) VALUES(${req.body.customerNumber}, '${req.body.product.productCode}', 1, 0)`
                }else{
                    sql = `INSERT INTO cart(customerNumber, productCode, quantityIncart, preOrder) VALUES(${req.body.customerNumber}, '${req.body.product.productCode}', 1, 1)`
                }
                db.query(sql, (err) =>{
                    if(err) {
                        db.query('ROLLBACK')
                        console.log(err)
                        res.status(400).json({status: '.:error:.\nPlease try again.'})
                    }else{
                        db.query(`COMMIT`)
                        console.log('customerNumber '+ req.body.customerNumber + ' add productCode ' + req.body.product.productCode +' to cart.')
                        res.send({status: `.:${req.body.product.productName} added:.`})
                    }
                })
            }
        }
    })
})

app.post('/customer/cart',async (req, res) =>{
    let sql =`SELECT * FROM cart JOIN (SELECT productCode, productName, productLine, buyPrice FROM products) products ON cart.productCode = products.productCode WHERE customerNumber=${req.body.customerNumber}`
    await db.query(sql,(err, results) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            console.log('Get cart of customerNumber: ' + req.body.customerNumber)
            res.send({products: results})
        }
    })
})

app.post('/customer/finddiscount', (req, res) =>{
    if(req.body.discountCode){
        let sql = `SELECT * FROM discounts WHERE discountCode='${req.body.discountCode}'`
        db.query(sql, (err, results) =>{
            if(err){
                console.log(err)
                res.status(400).json({status: '.:error:.\nPlease try again.'})
            }else{
                if(!results[0]){
                    res.send({status: 'not found.', discount: {}})
                }else{
                    let startDate = new Date(results[0].startDate)
                    let nowDate = new Date()
                    let endDate = new Date(results[0].endDate)
                    if(nowDate < startDate || nowDate > endDate){
                        res.send({status: 'discount code out of date.', discount: {}})
                    }else if(results[0].quantity == 0){
                        res.send({status: 'Out of code.', discount: results[0]})
                    }
                    else res.send({status: 'found.', discount: results[0]})
                    console.log('found discount code.')
                }
            }
        })
        
    }else{
        res.send({starus:''})
    }
})

app.post('/customer/placeorder', (req, res) =>{
    db.query(`BEGIN`)
    let sql = `SELECT max(orderNumber) orderNumber FROM orders`
    db.query(sql, (err, results) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            let orderNumber = results[0].orderNumber + 1
            let date = new Date()
            db.query('SET FOREIGN_KEY_CHECKS = 0')
            sql = `INSERT INTO orders(orderNumber, orderDate, status, customerNumber, discountCode) 
            VALUES(${orderNumber},'${date.toISOString().split('T')[0]}', 'In Progress', ${req.body.customerNumber}, '${req.body.discountCode}')`
            db.query(sql, (err)=>{
                if(err){
                    console.log(err)
                    db.query(`ROLLBACK`)
                    res.status(400).json({status: '.:error:.\nPlease try again.'})      
                }else{
                    req.body.products.map(product =>{
                        sql = `INSERT INTO orderDetails(orderNumber, productCode, quantityOrdered, priceEach) 
                        VALUES(${orderNumber}, '${product.productCode}', ${product.quantityInCart}, ${product.buyPrice})`
                        db.query(sql, (err)=>{
                            if(err){
                                console.log(err)
                                db.query(`ROLLBACK`)
                                res.status(400).json({status: '.:error:.\nPlease try again.'})
                                return
                            }
                        })
                    })
                    sql = `SELECT * FROM customers WHERE customerNumber=${req.body.customerNumber}`
                    db.query(sql, (err, results) =>{
                        if(err){
                            console.log(err)
                            db.query(`ROLLBACK`)
                            res.status(400).json({status: '.:error:.\nPlease try again.'})
                        }else{
                            if(results[0]){
                                sql = `UPDATE customers SET point=${results[0].point + req.body.buyPoint} WHERE customerNumber=${req.body.customerNumber}`
                                db.query(sql, (err)=>{
                                    if(err){
                                        console.log(err)
                                        db.query(`ROLLBACK`)
                                        res.status(400).json({status: '.:error:.\nPlease try again.'})
                                    }else{
                                        sql = `DELETE FROM cart WHERE customerNumber=${req.body.customerNumber}`
                                        db.query(sql, (err)=>{
                                            if(err){
                                                console.log(err)
                                                db.query(`ROLLBACK`)
                                                res.status(400).json({status: '.:error:.\nPlease try again.'})
                                            }else{
                                                if(req.body.discountCode){
                                                    sql = `SELECT * FROM discounts WHERE discountCode='${req.body.discountCode}'`
                                                    db.query(sql, (err, results)=>{
                                                        if(err){
                                                            console.log(err)
                                                            db.query(`ROLLBACK`)
                                                            res.status(400).json({status: '.:error:.\nPlease try again.'})
                                                        }else{
                                                            if(results[0]){
                                                                sql = `UPDATE discounts SET quantity=${results[0].quantity - 1} WHERE discountCode='${req.body.discountCode}'`
                                                                db.query(sql, (err) =>{
                                                                    if(err){
                                                                        console.log(err)
                                                                        db.query(`ROLLBACK`)
                                                                        res.status(400).json({status: '.:error:.\nPlease try again.'})
                                                                    }else{
                                                                        db.query(`COMMIT`)
                                                                        console.log('customer '+ req.body.customerNumber + ' placed order')
                                                                        res.send({status: '.:Placed order:.'})
                                                                    }
                                                                })
                                                            }
                                                        }
                                                    })
                                                }else{
                                                    db.query(`COMMIT`)
                                                    console.log('customer '+ req.body.customerNumber + ' placed order')
                                                    res.send({status: '.:Placed order:.'})
                                                }
                                            }
                                        })
                                    }
                                })
                            }
                        }
                    })
                            
                }
            }) 
        }
    })
})

app.post('/customer/inprogressorders', (req, res) =>{
    let sql =`SELECT * FROM orders JOIN (SELECT orderNumber, sum(quantityOrdered * priceEach) total FROM orderDetails GROUP BY orderNumber) od 
    ON orders.orderNumber = od.orderNumber WHERE customerNumber=${req.body.customerNumber} AND orders.status='in progress' AND
    orders.orderNumber NOT IN (SELECT orderNumber FROM paymentorders)`
    db.query(sql, (err, results) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            res.send({orders: results})
            console.log('get in progress orders.')
        }
    })
})

app.post('/customer/orders', (req, res) =>{
    let sql =`SELECT * FROM orders JOIN (SELECT orderNumber, sum(quantityOrdered * priceEach) total FROM orderDetails GROUP BY orderNumber) od 
    ON orders.orderNumber = od.orderNumber WHERE customerNumber=${req.body.customerNumber}`
    db.query(sql, (err, results) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            res.send({orders: results})
            console.log('get orders.')
        }
    })
})

// ------------------------------ add initail customer/employee Users table-----------------------------------//
app.post('/customer/init',async (req,res) =>{
    let sql = `SELECT customerNumber FROM customers`
    let password = await bcryptjs.hash('123456', 10)
     db.query(sql, (err, results) =>{
        if(err) console.log(err)
        results.map(customer =>{
            // let sql2 = `INSERT INTO customerusers (customerNumber, password) VALUES ('${customer.customerNumber}', '${password}')`
            let sql2 = `UPDATE customerusers SET password='${password}' WHERE customerNumber='${customer.customerNumber}'`
            db.query('SET FOREIGN_KEY_CHECKS = 0')
            db.query(sql2,(err) =>{
                if(err) console.log(err)
            })
        })
        res.send({status:'OK'})
    })
})

app.post('/customer/disputedOrder', (req, res) =>{
    let sql = `UPDATE orders SET status='Disputed' WHERE orderNumber=${req.body.orderNumber}`
    db.query(sql, (err) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            res.send({status: `.:Order number ${req.body.orderNumber} Disputed:.`})
        }
    })
})

app.post('/customer/receivedOrder', (req, res) =>{
    let sql = `UPDATE orders SET received=true WHERE orderNumber=${req.body.orderNumber}`
    db.query(sql, (err) =>{
        if(err){
            console.log(err)
            res.status(400).json({status: '.:error:.\nPlease try again.'})
        }else{
            res.send({status: `.:Order number ${req.body.orderNumber} Received:.`})
        }
    })
})

//------------------------------add orderNumber in payments---------------------------------------//
app.post('/employee/addorderNumber',(req, res) =>{
    let sql =`SELECT orders.orderNumber, orders.customerNumber, orr.amount FROM orders JOIN (SELECT orderNumber, SUM(orderdetails.quantityOrdered * priceEach) amount 
    FROM orderdetails GROUP BY orderNumber) orr ON orders.orderNumber = orr.orderNumber`
    db.query(sql, (err, results) => {
        if(err) console.log(err)
        
        results.map(result =>{
            // db.query('SET FOREIGN_KEY_CHECKS = 0')
            sql = `UPDATE payments SET orderNumber=${result.orderNumber} WHERE amount=${result.amount} AND customerNumber=${result.customerNumber}`
            db.query(sql, (err) =>{
                if(err) console.log(err)
                else console.log(result.amount)
            })
        })
        res.send({status:'OK'})
    })
})

app.post('/image',(req, res) =>{
    let sql = `UPDATE productlines SET image = './Classic Cars.jpg' WHERE productLine='Classic Cars'`
    db.query(sql, (err) =>{
        if(err) console.log(err)
    })
})



// This clause must be at the bottom.
app.listen(PORT , () => {
    console.log(`Server started on post ${PORT}`)
})