---
cover: /assets/images/cover2.jpg
icon: pen-to-square
date: 2022-01-12
category:
  - 蔬菜
tag:
  - 2222
  - 圆
star: true
sticky: true
---

# BCrypt 密码加密和解密

#### 简介：bcrypt是一种跨平台的文件加密工具。


Bcrypt就是一款加密工具，可以比较方便地实现数据的加密工作。你也可以简单理解为它内部自己实现了随机加盐处理



例如，我们使用MD5加密，每次加密后的密文其实都是一样的，这样就方便了MD5通过大数据的方式进行破解。



Bcrypt生成的密文是60位的。而MD5的是32位的。



使用BCrypt 主要是能实现每次加密的值都是不一样的。

#### maven依赖：


```xml
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-web</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-config</artifactId>
</dependency>
```



#### 测试：


```java
public class BcryptTest {
    public static void main(String[] args) {
        //用户密码
        String password = "123456";
        //密码加密
        BCryptPasswordEncoder passwordEncoder=new BCryptPasswordEncoder();
        //加密
        String newPassword = passwordEncoder.encode(password);
        System.out.println("加密密码为："+newPassword);
        //对比这两个密码是否是同一个密码
        boolean matches = passwordEncoder.matches(password, newPassword);
        System.out.println("两个密码一致:"+matches);
    }
}
```



#### 结果1：
![](https://cdn.nlark.com/yuque/0/2020/png/559924/1584688917333-5abea737-da71-4484-9e46-0c5ab402775e.png)



再运行一次



#### 结果2：


![](https://cdn.nlark.com/yuque/0/2020/png/559924/1584688917330-01a0b34b-989f-4d51-83da-440ec986a20b.png)



#### 结论：
发现同一个密码加密后的结果都不一样，所以不能被反推破解。

